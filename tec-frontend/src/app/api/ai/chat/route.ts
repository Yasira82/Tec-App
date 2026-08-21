import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify }                 from 'jose';
import { TEC_SYSTEM_PROMPT } from '@/lib/ai/tec-ai-system-prompt';
import { checkRateLimit }    from '@/lib/ai/rate-limit';

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
): Promise<Response> => {
  return fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    signal,
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-3-5-sonnet-20240620',
      max_tokens: 1024,
      system:     systemPrompt,
      messages,
      stream:     true,
    }),
  });
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
const GROQ_MODELS = [
  process.env.GROQ_MODEL,
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'llama3-8b-8192',
  'llama3-70b-8192',
  'gemma2-9b-it',
  'mixtral-8x7b-32768',
].filter(Boolean) as string[];

const GEMINI_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-flash-latest',   // Google's own moving alias — survives rotation
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
].filter(Boolean) as string[];

/** True when a failed response means "this model id is unusable" (so: try the next). */
async function isModelRejection(res: Response): Promise<boolean> {
  if (res.status !== 404 && res.status !== 400) return false;
  const body = typeof res.text === 'function' ? await res.text().catch(() => '') : '';
  return /model/i.test(body) &&
    /(not exist|not found|decommission|unsupported|no longer|access to it)/i.test(body);
}

/** Remembers the model that worked, so a healthy request never re-probes the list. */
const lastGoodModel: Record<string, string> = {};

/** Try each candidate model until one is not rejected as missing/inaccessible. */
async function withModelFallback(
  provider: string,
  candidates: string[],
  call: (model: string) => Promise<Response>,
): Promise<Response> {
  const known  = lastGoodModel[provider];
  const models = known ? [known, ...candidates.filter(m => m !== known)] : candidates;

  let last: Response | null = null;
  for (const model of models) {
    const res = await call(model);
    if (res.ok) { lastGoodModel[provider] = model; return res; }
    if (!(await isModelRejection(res))) return res;   // a real error — report it
    last = res;                                       // retired model — try the next
  }
  return last ?? new Response('no model candidates', { status: 500 });
}

// ── 2️⃣ Groq ──────────────────────────────────────────────
const callGroq = async (
  messages:     Message[],
  systemPrompt: string,
  apiKey:       string,
  signal?:      AbortSignal,
): Promise<Response> =>
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
        max_tokens: 1024,
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
): Promise<Response> => {
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
          generationConfig:   { maxOutputTokens: 1024 },
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

          if (provider === 'claude') {
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              text = parsed.delta.text;
            }
          } else if (provider === 'groq') {
            if (parsed.choices?.[0]?.delta?.content) {
              text = parsed.choices[0].delta.content;
            }
          } else if (provider === 'gemini') {
            if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
              text = parsed.candidates[0].content.parts[0].text;
            }
          }

          if (text) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`),
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
      { error: 'Please sign in to use the TEC Assistant.' },
      { status: 401, headers: corsHeaders },
    );
  }

  // Rate limit — 20 req/min per authenticated user (durable when configured)
  const rate = await checkRateLimit(userId);
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in a minute.' },
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

    const userContext: { username?: string; balance?: number; locale?: string } | undefined
      = body.userContext;

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
        { error: 'AI service not configured' },
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
      call: (signal: AbortSignal) => Promise<Response>,
      budgetMs: number = PROVIDER_TIMEOUT_MS,
    ): Promise<Response | null> => {
      const controller = new AbortController();
      const timer      = setTimeout(() => controller.abort(), budgetMs);
      try {
        const res = await call(controller.signal);
        clearTimeout(timer);
        if (res.ok && res.body) return res;
        const detail = typeof res.text === 'function'
          ? await res.text().catch(() => '')
          : '';
        failures.push(`${name} ${res.status}: ${detail.replace(/\s+/g, ' ').slice(0, 160)}`);
        return null;
      } catch (e) {
        clearTimeout(timer);
        failures.push(`${name} error: ${((e as Error)?.message ?? 'unknown').slice(0, 100)}`);
        return null;
      }
    };

    const providers: Array<[string, string | undefined, (s: AbortSignal) => Promise<Response>]> = [
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
      console.error('[AI] all providers failed:', failures.join(' | '));
      return NextResponse.json(
        { error: `All AI providers failed — ${failures.join(' · ') || 'none configured'}` },
        { status: 502, headers: corsHeaders },
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
