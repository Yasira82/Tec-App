import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify }                 from 'jose';
import { TEC_SYSTEM_PROMPT } from '@/lib/ai/tec-ai-system-prompt';
import { checkRateLimit, checkAttachmentAllowance } from '@/lib/ai/rate-limit';
import { parseAttachments, attachmentNote, ATTACHMENTS_PER_DAY } from '@/lib/ai/attachments';
import { verifyContext }     from '@/lib/ai/context-token';
import { budgetPromptLine, type AiLifeBudget } from '@/lib/ai/life-context';
import { resolveReplyLanguage, replyLanguageLine, type ReplyLanguage } from '@/lib/ai/reply-language';
import { LOCALE_CODES } from '@/lib/locales';
import { observeIntent }     from '@/lib/ai/intent-observation';
import { isProductAsk, searchProducts, productSection } from '@/lib/ai/product-search';
import {
  callClaude, callGroq, callOpenRouter, callGemini, createUnifiedStream,
  type Message, type ProviderResult,
} from '@/lib/ai/providers';

export const runtime = 'edge';


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
  /** Signed in, but the signed context did not come with this message. */
  contextMissing?: boolean;
  username?: string;
  balance?:  number;
  locale?:   string;
  /** Resolved server-side (lib/ai/reply-language.ts): the setting, then the message's script, then mirror. */
  replyLanguage?: ReplyLanguage;
  /** The user's chosen answer length, from the assistant's settings menu. */
  replyLength?: 'short' | 'detailed';
  // Personalization (C-104 reasoning input · C-121 pipeline). All OWN-SCOPE, assembled
  // server-side by /api/bff/ai/context. Present only when the user has this data.
  kycVerified?: boolean;
  goals?:       { title: string; done: boolean }[];
  focus?:       string;
  activity?:    { logins?: number; payments?: number; volume?: string };
  /** A1 — from Life's consent door: the ladder word per skill, and a pace only when Life calls it projectable. */
  skills?:      { name: string; level: string }[];
  pace?:        { pi_per_week: number; active_days: number };
  /** Life's door, when BUDGET is granted: this month's caps — the person's limits, never their spending. */
  budget?:      AiLifeBudget;
}

const buildSystemPrompt = (userContext?: UserContext) => {
  // Completed goals are still the person's goals. Dropping them made a single finished
  // goal read as "NONE shared" — and the Settings screen said "Goals ✓ shared · 1".
  const goals = (userContext?.goals ?? []).filter(g => !g.done).slice(0, 5);
  const done  = (userContext?.goals ?? []).filter(g => g.done).slice(0, 5);
  const a     = userContext?.activity;
  const skills = (userContext?.skills ?? []).slice(0, 5);
  const skillsLine = skills.length
    ? `- Skills (self-declared, a ladder — never a score): ${skills.map(s => `${s.name} — ${s.level.toLowerCase()}`).join('; ')}`
    : '';
  const p = userContext?.pace;
  const paceLine = p
    ? `- Pace toward their goals: about ${p.pi_per_week} π/week over ${p.active_days} active days (their own logged steps — encourage, never judge; not a prediction and not advice)`
    : '';
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
A skill is something to route TOWARD (NX for mentorship and opportunities, DX for building),
never something to grade. A pace is something to encourage, never to judge. NEVER state a
number this context does not hold — if a pace or a skill is absent, the person did not share
it, and you say nothing about it.
${userContext?.username ? `- Username: @${userContext.username}` : '- User: Guest'}
${userContext?.balance !== undefined ? `- TEC Balance: ${userContext.balance.toFixed(2)} TEC` : ''}
${userContext?.kycVerified !== undefined ? `- KYC (via Pi): ${userContext.kycVerified ? 'verified' : 'not verified'}` : ''}
${userContext?.focus ? `- Stated focus: ${userContext.focus}` : ''}
${userContext?.contextMissing
  ? '- Personal context (Life goals, skills, activity): it did NOT reach you for this message — a loading problem, not their choice. If asked about their goals, say you could not load them just now and to ask again in a moment. Never say they shared none.'
  : ''}
${goals.length
  ? `- Active goals: ${goals.map(g => g.title).join('; ')}`
  : ''}
${done.length ? `- Completed goals: ${done.map(g => g.title).join('; ')}` : ''}
${goals.length || done.length || userContext?.contextMissing
  ? ''
  : userContext?.username
    ? '- Life goals: NONE shared with you — either they have no active goals, or Goals is not granted to TEC AI (Life → Privacy). If asked, say exactly that.'
    : ''}
${skillsLine}
${paceLine}
${budgetPromptLine(userContext?.budget)}
${activityLine}
${userContext?.replyLanguage ? replyLanguageLine(userContext.replyLanguage) : ''}
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

// ── Providers ─────────────────────────────────────────────
// Claude · Groq · OpenRouter · Gemini, their model lists and the stream transform: lib/ai/providers.ts.


/**
 * IIC 3.3 — record what the user asked, as a structured intent object, and do NOTHING
 * with it. No routing changes, no prompt changes, no execution. It exists so the closed
 * objective set in IIC 4.3 can be designed from asks people actually made.
 *
 * ── Three decisions ─────────────────────────────────────────────────────────────
 *
 * 1. **Every user turn, not only the ones the model routes.** The plan said "on every
 *    recommendation", and the recommendation is only knowable after the reply has
 *    streamed. But filtering to marker-bearing replies would sample only the objectives
 *    the current system prompt already knows how to route — precisely the wrong sample
 *    for discovering which ones are MISSING. The ask is the intent; the reply is the
 *    platform's answer to it.
 *
 * 2. **Fire-and-forget, and it may never complete.** This must not add a millisecond to
 *    the answer, and a research instrument that can fail a chat is a bad trade at any
 *    price. It is issued before the stream opens, so it has the whole life of the
 *    response to land; if it does not, one observation is lost and nobody notices. Every
 *    failure path is swallowed on purpose — that is the one place in this codebase where
 *    a silent catch is correct, because the alternative is a broken assistant.
 *
 * 3. **Server-side, from the message this route holds.** A client-fed intent is a claim,
 *    not evidence — the lesson Life's intent store already settled. The owner comes from
 *    the caller's own token at the sink, never from anything in this body.
 */
function recordIntentObservation(
  req: NextRequest,
  messages: Message[],
  locale: string | undefined,
): void {
  const gateway = process.env.API_GATEWAY_URL;
  const secret  = process.env.INTERNAL_SECRET;
  if (!gateway || !secret) return;

  const userTurns = messages.filter((m) => m.role === 'user');
  const lastUser  = userTurns[userTurns.length - 1];
  if (!lastUser?.content) return;
  // Read ONLY when the last ask is a bare continuation ("وبعدين", "go on") — see
  // CONTINUATION in lib/ai/intent-observation.ts.
  const previous  = userTurns[userTurns.length - 2]?.content;

  const bearer = req.headers.get('authorization')
    ?? (req.cookies?.get?.('tec_access_token')?.value
      ? `Bearer ${req.cookies.get('tec_access_token')!.value}`
      : null);
  if (!bearer) return;   // no user scope → an unattributable row the research cannot use

  void (async () => {
    try {
      const observation = await observeIntent(lastUser.content, {
        ...(previous ? { previous } : {}),
        // Narrowed, not cast: the sink refuses anything but en/ar, and an observation
        // dropped for a locale it did not need is one this instrument threw away.
        ...(locale === 'en' || locale === 'ar' ? { locale } : {}),
      });
      if (!observation) return;
      await fetch(`${gateway.replace(/\/$/, '')}/api/analytics/ai/intent-observation`, {
        method:  'POST',
        headers: {
          'Content-Type':   'application/json',
          'authorization':  bearer,
          'x-internal-key': secret,
        },
        body: JSON.stringify(observation),
      });
    } catch {
      // Deliberate. See decision 2 above.
    }
  })();
}

// ── tec-ai-service first ─────────────────────────────────
/**
 * TEC AI's reasoning now runs in tec-ai-service (`POST /identity/ai/chat`, reached through
 * the gateway as `/api/identity/ai/chat`) — the same code as below, moved with its tests
 * (tec-core-backend #419). This route forwards the request there first and passes the answer
 * through as it streams.
 *
 * The code below stays as the fallback (owner, 2026-10-13: "the Hub falls back to its own
 * code"). A reply is the service's ONLY when it carries `x-tec-ai: service`; anything else —
 * the gateway cannot reach the service, the service is down, or it has no provider key yet
 * (it answers NOT_CONFIGURED without the marker) — and this route answers by itself, exactly
 * as before. So a broken service costs the user nothing but a moment.
 *
 * `AI_SERVICE_CHAT=off` skips the forward entirely.
 */
async function forwardToService(req: NextRequest, rawBody: string, corsHeaders: Record<string, string>): Promise<Response | null> {
  const gateway = process.env.API_GATEWAY_URL;
  if (!gateway || process.env.AI_SERVICE_CHAT === 'off') return null;
  const bearer = req.headers.get('authorization')
    ?? (req.cookies?.get?.('tec_access_token')?.value ? `Bearer ${req.cookies.get('tec_access_token')!.value}` : null);
  if (!bearer) return null;   // no session — the local gate below answers SIGN_IN

  try {
    const res = await fetch(`${gateway.replace(/\/$/, '')}/api/identity/ai/chat`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'authorization': bearer,
        ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
      },
      body:  rawBody,
      cache: 'no-store',
    });
    if (res.headers.get('x-tec-ai') !== 'service') {
      await res.body?.cancel().catch(() => undefined);
      return null;
    }
    const headers: Record<string, string> = { ...corsHeaders };
    for (const h of ['content-type', 'cache-control', 'retry-after', 'x-ai-provider', 'x-tec-ai']) {
      const v = res.headers.get(h);
      if (v) headers[h] = v;
    }
    return new NextResponse(res.body, { status: res.status, headers });
  } catch (err) {
    console.error('[AI] tec-ai-service unreachable — answering locally:', (err as Error)?.message);
    return null;
  }
}

// ── Main POST Handler ─────────────────────────────────────
export async function POST(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  // The body can be read once; the forward and the local path both need it.
  // An unreadable body is answered by the local path below (500), as before.
  const rawBody = await req.text().catch(() => '');
  const fromService = await forwardToService(req, rawBody, corsHeaders);
  if (fromService) return fromService;

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
    const body = JSON.parse(rawBody);

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

    // The interface language (`locale`) and the reply choice (`replyLocale`) are two
    // different facts. The clients used to fold them into one field, and the route read
    // it as "reply in this" — so an Arabic question in an English interface was answered
    // in English (owner's /hub/admin/life-ai, 2026-10-07). Both are narrowed against the
    // twelve locales; the message's own script outranks the interface.
    const uiLocale     = oneOf(raw.locale, LOCALE_CODES);
    const lastUserText = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const replyLanguage = resolveReplyLanguage({ setting: raw.replyLocale, lastMessage: lastUserText, ui: uiLocale });

    const userContext: UserContext = {
      locale:      uiLocale,
      replyLanguage,
      replyLength: oneOf(raw.replyLength, ['short', 'detailed'] as const),
      // Claims — verified, or absent. There is deliberately no fallback to the
      // body: failing closed here means a less personal answer, and falling open
      // means the prompt states things nobody checked (P6).
      ...(claims ?? {}),
      // Signed in, but no valid context came with the message (slow, expired, unsigned).
      // Said to the model as exactly that, so a load problem is never answered as
      // "you shared no goals".
      contextMissing: !claims,
    };

    if (!messages.length) {
      return NextResponse.json(
        { error: 'messages array is required' },
        { status: 400, headers: corsHeaders },
      );
    }

    // Attachments (lib/ai/attachments.ts) — for THIS message only, never stored.
    const parsedAtt = parseAttachments(body.attachments);
    if (!parsedAtt.ok) {
      return NextResponse.json(
        { error: 'Attachments must be up to 3 photos (JPG, PNG, WebP) or PDFs, within the size limit.', code: parsedAtt.code },
        { status: 400, headers: corsHeaders },
      );
    }
    const attachments = parsedAtt.attachments;
    if (attachments.length) {
      // A file is counted once a day however many messages carry it (rate-limit.ts).
      const fileIds = await Promise.all(attachments.map(async (a) => {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(a.data));
        return Array.from(new Uint8Array(digest).slice(0, 12), b => b.toString(16).padStart(2, '0')).join('');
      }));
      const allowance = await checkAttachmentAllowance(userId, fileIds, ATTACHMENTS_PER_DAY);
      if (!allowance.ok) {
        return NextResponse.json(
          { error: `Today's ${ATTACHMENTS_PER_DAY} attachments are used — try again tomorrow.`, code: 'ATTACH_LIMIT' },
          { status: 429, headers: corsHeaders },
        );
      }
    }

    // IIC 3.3 — observe, and do nothing with it. Never awaited: the answer does not
    // wait on an instrument.
    const obsLocale = replyLanguage.code === 'ar' || replyLanguage.code === 'en'
      ? replyLanguage.code
      : replyLanguage.code === null && (uiLocale === 'en' || uiLocale === 'ar') ? uiLocale : undefined;
    recordIntentObservation(req, messages, obsLocale);

    // Product search — the assistant names real listings or says there are none
    // (lib/ai/product-search.ts). Awaited, but bounded by its own short timeout.
    const productAsk = isProductAsk(lastUserText);
    const products = productAsk && process.env.API_GATEWAY_URL
      ? await searchProducts(process.env.API_GATEWAY_URL, lastUserText, { internalKey: process.env.INTERNAL_SECRET })
      : null;

    const systemPrompt = buildSystemPrompt(userContext)
      + (products ? `\n${productSection(products)}\n` : '')
      + (attachments.length ? `\n${attachmentNote(attachments)}\n` : '');
    const claudeKey    = process.env.ANTHROPIC_API_KEY;
    const groqKey      = process.env.GROQ_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const geminiKey    = process.env.GEMINI_API_KEY;

    if (!claudeKey && !groqKey && !geminiKey && !openrouterKey) {
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
      // FREE first (owner, 2026-10-08): Gemini and Groq have free tiers, OpenRouter
      // serves free GPT. Claude is paid, so it comes LAST — it answers only when every
      // free provider failed, and never at all if ANTHROPIC_API_KEY is unset.
      ['gemini',     geminiKey, (s) => callGemini(messages, systemPrompt, geminiKey!, s, attachments)],
      // Groq's and OpenRouter's candidates read text only — a message with a photo or PDF never goes there.
      ['groq',       attachments.length ? undefined : groqKey, (s) => callGroq(messages, systemPrompt, groqKey!, s)],
      ['openrouter', attachments.length ? undefined : openrouterKey, (s) => callOpenRouter(messages, systemPrompt, openrouterKey!, s)],
      ['claude',     claudeKey, (s) => callClaude(messages, systemPrompt, claudeKey!, s, attachments)],
    ];

    // Put the last provider that worked at the front, so a provider that is currently
    // down is not re-tried first on every request (paying its timeout each time).
    const ordered = lastGoodProvider
      ? [...providers].sort((a, b) =>
          (b[0] === lastGoodProvider ? 1 : 0) - (a[0] === lastGoodProvider ? 1 : 0))
      : providers;
    const configured = ordered.filter(([, key]) => !!key);
    if (attachments.length && !configured.length) {
      // Only a text-only model is configured. Answering as if the photo had been read
      // would be the worst outcome — say so instead.
      return NextResponse.json(
        { error: 'The assistant cannot read attachments right now — send your question as text.', code: 'ATTACH_UNSUPPORTED' },
        { status: 503, headers: corsHeaders },
      );
    }

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
