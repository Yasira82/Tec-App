import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify }                 from 'jose';
import { TEC_SYSTEM_PROMPT } from '@/lib/ai/tec-ai-system-prompt';
import { checkRateLimit }    from '@/lib/ai/rate-limit';
import { verifyContext }     from '@/lib/ai/context-token';

export const runtime = 'edge';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Last provider that actually answered, remembered per edge instance.
 *
 * Providers were always tried in a FIXED order (claude → groq → gemini). When the
 * first one is down or throttled, every single request pays its full timeout before
 * falling through — so one dead provider makes the whole assistant feel slow, request
 * after request, even though a healthy provider is sitting right behind it.
 *
 * Trying the last known-good provider first turns that repeated cost into a one-off.
 * Best-effort only: it is per-instance memory, never correctness — the full fallback
 * chain still runs behind it.
 */
let lastGoodProvider: string | null = null;

/**
 * Output cap for every provider.
 *
 * It was 1024 tokens, and a normal "what can I do on TEC?" answer — a list of apps with
 * a line each — runs past that, so the reply simply stopped mid-sentence with nothing to
 * explain why. 2048 covers those answers; the stream now also FLAGS the cap when it is
 * hit (see createUnifiedStream) so a truncated answer says so instead of pretending to
 * be complete (C-96 — no silent failures). Tunable without a deploy.
 */
const MAX_TOKENS = Number(process.env.AI_MAX_TOKENS) || 2048;

/** Pause before re-walking a candidate list where every model reported overload. */
const OVERLOAD_RETRY_MS = Number(process.env.AI_OVERLOAD_RETRY_MS) || 700;

// ── Auth gate ─────────────────────────────────────────────
// The AI providers cost real money, so this endpoint is for authenticated TEC
// users ONLY — an open endpoint can be drained by anyone. Verify the TEC session
// (same HS256 JWT + JWT_SECRET the BFF uses) before calling any provider. Returns
// the user id (token `sub`) or null. Edge-safe (jose uses Web Crypto).
async function authenticate(req: NextRequest): Promise<string | null> {
  const bearer = req.headers.get('authorization');
  const token  = bearer?.startsWith('Bearer ')
    ? bearer.slice(7)
    : req.cookies?.get?.('tec_access_token')?.value;
  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) return null; // fail closed — no secret, no trust

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
    });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

// ── Rate Limiter ──────────────────────────────────────────
// Keyed by the VERIFIED user id (not IP) — an IP is trivially rotated, a Pi session
// is not. Durable across edge instances when Upstash REST is configured, else a
// bounded in-memory fallback. See src/lib/ai/rate-limit.ts. (checkRateLimit is async.)

// ── CORS ──────────────────────────────────────────────────
function getCorsHeaders(req: NextRequest) {
  const origin    = req.headers.get('origin') || '';
  const isAllowed = origin.endsWith('.vercel.app') || origin.startsWith('http://localhost');
  return {
    'Access-Control-Allow-Origin':  isAllowed ? origin : '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

interface UserContext {
  username?: string;
  balance?:  number;
  locale?:   string;
  /** The user's chosen answer length, from the assistant's settings menu. */
  replyLength?: 'short' | 'detailed';
  // Personalization (C-104 reasoning input · C-121 pipeline). All OWN-SCOPE, assembled
  // server-side by /api/bff/ai/context. Present only when the user has this data.
  kycVerified?: boolean;
  goals?:       { title: string; done: boolean }[];
  focus?:       string;
  activity?:    { logins?: number; payments?: number; volume?: string };
}

const buildSystemPrompt = (userContext?: UserContext) => {
  const goals = (userContext?.goals ?? []).filter(g => !g.done).slice(0, 5);
  const a     = userContext?.activity;
  const activityLine = a && (a.logins !== undefined || a.payments !== undefined || a.volume !== undefined)
    ? `- Recent activity: ${[
        a.logins   !== undefined ? `${a.logins} logins`     : null,
        a.payments !== undefined ? `${a.payments} payments`  : null,
        a.volume                 ? `${a.volume} volume`       : null,
      ].filter(Boolean).join(' · ')}`
    : '';

  return `${TEC_SYSTEM_PROMPT}

## CURRENT USER CONTEXT
This is the user's OWN private context (their session, their data). Use it to make your
guidance specific and relevant — reference a goal or their activity when it helps. NEVER
reveal it back verbatim as if you surveilled them, never treat activity numbers as
financial truth (the owning app is the source), and keep the honesty rules above.
${userContext?.username ? `- Username: @${userContext.username}` : '- User: Guest'}
${userContext?.balance !== undefined ? `- TEC Balance: ${userContext.balance.toFixed(2)} TEC` : ''}
${userContext?.kycVerified !== undefined ? `- KYC (via Pi): ${userContext.kycVerified ? 'verified' : 'not verified'}` : ''}
${userContext?.focus ? `- Stated focus: ${userContext.focus}` : ''}
${goals.length ? `- Active goals: ${goals.map(g => g.title).join('; ')}` : ''}
${activityLine}
${userContext?.locale ? `- Language preference: ${userContext.locale === 'ar' ? 'Arabic' : 'English'}` : ''}
${userContext?.replyLength === 'short'
  ? '- Answer length: SHORT. Two or three sentences, or a handful of bullets. The user chose brevity — respect it over completeness.'
  : ''}
`;
};

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status:  204,
    headers: getCorsHeaders(req),
  });
}

// ── 1️⃣ Claude ────────────────────────────────────────────
const callClaude = async (
  messages:     Message[],
  systemPrompt: string,
  apiKey:       string,
  signal?:      AbortSignal,
): Promise<ProviderResult> => {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    signal,
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-3-5-sonnet-20240620',
      max_tokens: MAX_TOKENS,
      system:     systemPrompt,
      messages,
      stream:     true,
    }),
  });
  return res.ok ? { ok: true, res } : readFailure(res);
};

/**
 * Model rotation is the single biggest source of AI outages here: a hardcoded model id
 * gets retired (or the key loses access to it) and the provider starts answering
 *   404 "The model `x` does not exist or you do not have access to it"
 * — which reads as "the whole assistant is down". It has now happened twice.
 *
 * So no single model id is trusted. Each provider carries a CANDIDATE LIST, tried in
 * order, skipping anything the API reports as missing/inaccessible. A rejected model
 * costs one fast 404, not an outage. The env override is always tried first, so a
 * known-good model can be pinned without a deploy.
 */
/**
 * ⚠️ ORDER IS THE CONTRACT — the head of each list is a model VERIFIED in production.
 *
 * When these lists were introduced, they were filled from recollection, and that quietly
 * DROPPED the ids that #154 had already researched and pinned as current:
 * `gemini-3.6-flash` and `llama-3.1-8b-instant`. Gemini's replacements were all OLDER
 * (2.5 / 2.0 / 1.5) — on a free tier those are the crowded ones, which is exactly where
 * the "This model is currently experiencing high demand" 503s came from. A change meant
 * to make the assistant survive model rotation is what took the working model away.
 *
 * The rule this encodes: a newer model id looking unfamiliar is not evidence that it is
 * wrong — it is evidence that it was released recently. NEVER remove or demote an id that
 * production has served traffic on. Add candidates BELOW it; verify with /api/ai/health
 * before reordering. `models-pinned.test.ts` fails the build if a pinned id disappears.
 */
export const GROQ_MODELS = [
  process.env.GROQ_MODEL,
  'llama-3.1-8b-instant',      // pinned by #154 — do not demote without evidence
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-20b',
  'gemma2-9b-it',
  // Older ids, kept LAST: Groq has been retiring these. A retired id costs one fast 404
  // and the walk continues, so leaving them in is cheap insurance, not a liability.
  'llama3-8b-8192',
  'llama3-70b-8192',
  'mixtral-8x7b-32768',
].filter(Boolean) as string[];

export const GEMINI_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-3.6-flash',          // pinned by #154 — the model that was actually serving
  'gemini-flash-latest',       // Google's own moving alias
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
].filter(Boolean) as string[];

/**
 * A provider call either produced a streaming response, or failed with a reason we can
 * actually read.
 *
 * This type exists because of a real blind spot: a `Response` body can be consumed only
 * ONCE. The old code read it inside the "is this model retired?" check and then read it
 * AGAIN when building the failure log — the second read returned an empty string, so
 * production logged `groq 400:` with nothing after it. The one thing we needed in order
 * to diagnose the outage was the one thing we destroyed. The body is now read exactly
 * once, at the point of failure, and carried.
 */
interface ProviderFailure { ok: false; status: number; detail: string }
type ProviderResult = { ok: true; res: Response } | ProviderFailure;

async function readFailure(res: Response): Promise<ProviderFailure> {
  const detail = typeof res.text === 'function' ? await res.text().catch(() => '') : '';
  return { ok: false, status: res.status, detail };
}

/** How a failed candidate should be treated. */
type FailureKind = 'model-gone' | 'overloaded' | 'fatal';

function classify(status: number, body: string): FailureKind {
  // The model id is retired, or this key has no access to it → the NEXT candidate might.
  if ((status === 404 || status === 400) &&
      /model/i.test(body) &&
      /(not exist|not found|decommission|unsupported|no longer|access to it)/i.test(body)) {
    return 'model-gone';
  }
  // The model is fine but momentarily unavailable. Gemini answers 503 "This model is
  // currently experiencing high demand. Spikes in demand are usually temporary." — the
  // API is literally telling us to try again, and a SIBLING model is usually free. The
  // old code treated this as fatal and returned, leaving three healthy fallback models
  // in the list untouched while the user got "all providers failed".
  if (status === 429 || status === 503 ||
      /(overload|high demand|capacity|try again later|rate.?limit|quota)/i.test(body)) {
    return 'overloaded';
  }
  return 'fatal';
}

/** Remembers the model that worked, so a healthy request never re-probes the list. */
const lastGoodModel: Record<string, string> = {};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Try each candidate model until one answers. A retired OR momentarily overloaded model
 * moves to the next candidate; only a genuine error (bad key, malformed request) stops
 * the walk, because trying a different model cannot fix those.
 *
 * If EVERY candidate was overloaded, the whole list is retried once after a short pause —
 * "spikes in demand are usually temporary" is worth one retry before telling the user the
 * assistant is down.
 */
async function withModelFallback(
  provider: string,
  candidates: string[],
  call: (model: string) => Promise<Response>,
): Promise<ProviderResult> {
  const known  = lastGoodModel[provider];
  const models = known ? [known, ...candidates.filter(m => m !== known)] : candidates;

  for (let round = 0; round < 2; round++) {
    if (round > 0) await sleep(OVERLOAD_RETRY_MS);

    let last: ProviderFailure | null = null;
    let allOverloaded = true;

    for (const model of models) {
      const res = await call(model);
      if (res.ok) { lastGoodModel[provider] = model; return { ok: true, res }; }

      const failure = await readFailure(res);
      const kind    = classify(failure.status, failure.detail);
      // Name the model in the reason — "groq 400" is useless without knowing WHICH model.
      last = { ...failure, detail: `[${model}] ${failure.detail}`.trim() };

      if (kind === 'fatal') return last;              // a different model won't help
      if (kind !== 'overloaded') allOverloaded = false;
      if (lastGoodModel[provider] === model) delete lastGoodModel[provider];
    }

    if (!allOverloaded) return last ?? { ok: false, status: 500, detail: 'no model candidates' };
    if (round === 1)    return last ?? { ok: false, status: 503, detail: 'all models overloaded' };
  }

  return { ok: false, status: 500, detail: 'no model candidates' };
}

// ── 2️⃣ Groq ──────────────────────────────────────────────
const callGroq = async (
  messages:     Message[],
  systemPrompt: string,
  apiKey:       string,
  signal?:      AbortSignal,
): Promise<ProviderResult> =>
  withModelFallback('groq', GROQ_MODELS, (model) =>
    fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      signal,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        messages:   [{ role: 'system', content: systemPrompt }, ...messages],
        stream:     true,
      }),
    }),
  );

// ── 3️⃣ Gemini ────────────────────────────────────────────
const callGemini = async (
  messages:     Message[],
  systemPrompt: string,
  apiKey:       string,
  signal?:      AbortSignal,
): Promise<ProviderResult> => {
  const geminiMessages = messages.map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  return withModelFallback('gemini', GEMINI_MODELS, (model) =>
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method:  'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents:           geminiMessages,
          generationConfig:   { maxOutputTokens: MAX_TOKENS },
        }),
      },
    ),
  );
};

// ── Unified Stream Transform ──────────────────────────────
function createUnifiedStream(provider: string) {
  const decoder = new TextDecoder('utf-8');
  const encoder = new TextEncoder();
  let buffer = '';

  return new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;

        const dataStr = trimmed.slice(5).trim();
        if (dataStr === '[DONE]' || !dataStr) continue;

        try {
          const parsed = JSON.parse(dataStr);
          let text = '';
          // Every provider says "I stopped because I hit the cap" in its own dialect.
          // Forwarding it lets the UI mark the answer incomplete instead of showing a
          // sentence that just ends (C-96 — a silent cut is an invisible failure).
          let capped = false;

          if (provider === 'claude') {
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              text = parsed.delta.text;
            }
            if (parsed.delta?.stop_reason === 'max_tokens') capped = true;
          } else if (provider === 'groq') {
            if (parsed.choices?.[0]?.delta?.content) {
              text = parsed.choices[0].delta.content;
            }
            if (parsed.choices?.[0]?.finish_reason === 'length') capped = true;
          } else if (provider === 'gemini') {
            if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
              text = parsed.candidates[0].content.parts[0].text;
            }
            if (parsed.candidates?.[0]?.finishReason === 'MAX_TOKENS') capped = true;
          }

          if (text) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`),
            );
          }
          if (capped) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ truncated: true })}\n\n`),
            );
          }
        } catch {
          // Ignore incomplete JSON — expected in SSE streams
        }
      }
    },
    flush() {
      buffer += decoder.decode(new Uint8Array(), { stream: false });
    },
  });
}

// ── Main POST Handler ─────────────────────────────────────
export async function POST(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  // ── Auth gate — logged-in TEC users only (protects the paid AI budget) ──
  const userId = await authenticate(req);
  if (!userId) {
    return NextResponse.json(
      { error: 'Please sign in to use the TEC Assistant.', code: 'SIGN_IN' },
      { status: 401, headers: corsHeaders },
    );
  }

  // Rate limit — 20 req/min per authenticated user (durable when configured)
  const rate = await checkRateLimit(userId);
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in a minute.', code: 'RATE_LIMIT' },
      { status: 429, headers: { ...corsHeaders, 'Retry-After': '60' } },
    );
  }

  try {
    const body = await req.json();

    const messages: Message[] = Array.isArray(body.messages) && body.messages.length > 0
      ? body.messages
      : body.message
        ? [{ role: 'user' as const, content: body.message }]
        : [];

    // ── The trust boundary ────────────────────────────────────────────────
    //
    // This used to be `body.userContext` — taken whole, unvalidated, and passed
    // straight into the system prompt. Every platform CLAIM about the user (KYC
    // status, their Life goals, their Analytics activity) was resolved by a BFF
    // from the gateway, handed to the browser, and posted back here. Editing one
    // fetch body was enough to tell the assistant you were KYC-verified.
    //
    // Nothing executes on these — the AI guides, it never acts (C-104 §4) — so
    // no money moves. It answers the user from premises the platform never
    // asserted, in the platform's voice. That is the damage, and it is enough.
    //
    // Now: claims come ONLY from a token this server signed for THIS `sub`
    // (lib/ai/context-token.ts). Preferences — the reply language and length the
    // user picked in the assistant's own settings menu — stay client-supplied,
    // because they assert nothing about the user and are theirs to choose.
    //
    // The split is *claims vs preferences*, not *server vs client*. Stated that
    // way, the next field added lands on the correct side on its own.
    const raw = (body.userContext ?? {}) as Record<string, unknown>;
    const claims = await verifyContext(body.contextToken, userId, process.env.JWT_SECRET);

    // Each preference is narrowed against a CLOSED set. An unrecognised value is
    // dropped rather than passed through, so the body cannot introduce a field
    // the prompt would render — the same reason the claims above are verified.
    const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
      typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;

    const userContext: UserContext = {
      locale:      oneOf(raw.locale,      ['en', 'ar'] as const),
      replyLength: oneOf(raw.replyLength, ['short', 'detailed'] as const),
      // Claims — verified, or absent. There is deliberately no fallback to the
      // body: failing closed here means a less personal answer, and falling open
      // means the prompt states things nobody checked (P6).
      ...(claims ?? {}),
    };

    if (!messages.length) {
      return NextResponse.json(
        { error: 'messages array is required' },
        { status: 400, headers: corsHeaders },
      );
    }

    const systemPrompt = buildSystemPrompt(userContext);
    const claudeKey    = process.env.ANTHROPIC_API_KEY;
    const groqKey      = process.env.GROQ_API_KEY;
    const geminiKey    = process.env.GEMINI_API_KEY;

    if (!claudeKey && !groqKey && !geminiKey) {
      return NextResponse.json(
        { error: 'AI service not configured', code: 'NOT_CONFIGURED' },
        { status: 503, headers: corsHeaders },
      );
    }

    // Try each configured provider in order, falling through on failure. Each attempt
    // is guarded by a timeout so a HUNG upstream (headers never arrive) can't stall the
    // whole request — we abort and move to the next provider. Once headers arrive the
    // timer is cleared and the body streams freely.
    // Budget for a provider to return RESPONSE HEADERS. Once they arrive the timer is
    // cleared and the answer streams for as long as it needs, so this never truncates a
    // long reply. Tunable without a deploy via AI_PROVIDER_TIMEOUT_MS.
    const PROVIDER_TIMEOUT_MS = Number(process.env.AI_PROVIDER_TIMEOUT_MS) || 9_000;
    // The LAST provider left gets a longer budget: there is nothing to fall through to,
    // so cutting it off early turns a slow answer into NO answer. Gemini was being
    // aborted at 12s and the user was told "all providers failed".
    const LAST_PROVIDER_TIMEOUT_MS = Math.max(PROVIDER_TIMEOUT_MS, 20_000);
    // Capture WHY each provider fails (status + body snippet) so a 502 tells us the real
    // cause — invalid key (401), decommissioned model (400/404), quota (429) — instead of
    // a black-box "all failed".
    const failures: string[] = [];
    const attempt = async (
      name: string,
      call: (signal: AbortSignal) => Promise<ProviderResult>,
      budgetMs: number = PROVIDER_TIMEOUT_MS,
    ): Promise<Response | null> => {
      const controller = new AbortController();
      const timer      = setTimeout(() => controller.abort(), budgetMs);
      try {
        const out = await call(controller.signal);
        clearTimeout(timer);
        if (out.ok && out.res.body) return out.res;
        // The detail was read once, at the point of failure, and carried here — reading
        // the body a second time is what used to produce an empty, useless reason.
        const detail = out.ok ? 'empty body' : out.detail;
        const status = out.ok ? 502 : out.status;
        failures.push(`${name} ${status}: ${detail.replace(/\s+/g, ' ').slice(0, 200)}`);
        return null;
      } catch (e) {
        clearTimeout(timer);
        failures.push(`${name} error: ${((e as Error)?.message ?? 'unknown').slice(0, 100)}`);
        return null;
      }
    };

    const providers: Array<[string, string | undefined, (s: AbortSignal) => Promise<ProviderResult>]> = [
      ['claude', claudeKey, (s) => callClaude(messages, systemPrompt, claudeKey!, s)],
      ['groq',   groqKey,   (s) => callGroq(messages, systemPrompt, groqKey!, s)],
      ['gemini', geminiKey, (s) => callGemini(messages, systemPrompt, geminiKey!, s)],
    ];

    // Put the last provider that worked at the front, so a provider that is currently
    // down is not re-tried first on every request (paying its timeout each time).
    const ordered = lastGoodProvider
      ? [...providers].sort((a, b) =>
          (b[0] === lastGoodProvider ? 1 : 0) - (a[0] === lastGoodProvider ? 1 : 0))
      : providers;
    const configured = ordered.filter(([, key]) => !!key);

    let response: Response | null = null;
    let provider = '';
    for (let i = 0; i < configured.length && !response; i++) {
      const [name, , call] = configured[i];
      const isLast = i === configured.length - 1;
      const res = await attempt(name, call, isLast ? LAST_PROVIDER_TIMEOUT_MS : PROVIDER_TIMEOUT_MS);
      if (res) { response = res; provider = name; }
    }
    if (provider) lastGoodProvider = provider;

    if (!response || !response.body) {
      // Full technical reason to the log (that is what it is for). The USER gets a short
      // sentence — a raw provider JSON blob in a chat bubble tells them nothing they can
      // act on, and it leaks vendor internals into the product.
      console.error('[AI] all providers failed:', failures.join(' | '));

      // "Every provider is momentarily busy" is a different fact from "the assistant is
      // broken", and it deserves a different answer: 503 + Retry-After, so a retry is the
      // obvious next step instead of a dead end.
      const allBusy = failures.length > 0 &&
        failures.every(f => /\b(429|503)\b|overload|high demand|capacity|quota|rate.?limit/i.test(f));

      return NextResponse.json(
        {
          error: allBusy
            ? 'The assistant is busy right now — please try again in a moment.'
            : 'The assistant is temporarily unavailable. Please try again shortly.',
          // The CLASSIFICATION is the server's job; the WORDING (and its language) is the
          // client's. Status alone could not carry this: "not configured" and "every
          // provider is busy" are both 503, and the clients were mapping that one status
          // to a single message — so a busy assistant told the user it was switched off.
          code: allBusy ? 'BUSY' : 'PROVIDERS_FAILED',
          detail: failures.join(' · ') || 'no provider configured',
        },
        {
          status:  allBusy ? 503 : 502,
          headers: allBusy ? { ...corsHeaders, 'Retry-After': '5' } : corsHeaders,
        },
      );
    }

    const stream = response.body.pipeThrough(createUnifiedStream(provider));

    return new NextResponse(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
        'X-AI-Provider': provider,
      },
    });

  } catch (error) {
    console.error('AI chat route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders },
    );
  }
}
