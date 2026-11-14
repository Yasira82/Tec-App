/**
 * The AI providers behind /api/ai/chat — Claude, Groq, OpenRouter and Gemini, each with
 * its pinned model list and the fallback walk between them — and the transform that
 * turns any of their streams into the one shape the drawer reads.
 *
 * Moved out of the route as it was (11 Nov 2026), so the route reads as one request:
 * authenticate, build the prompt, pick providers, stream. Nothing here changed when it
 * moved; models-pinned.test.ts and ai-attachments.test.ts read this file now.
 */
import { claudeContent, geminiParts, type Attachment } from '@/lib/ai/attachments';
import { freeOpenRouterModels } from '@/lib/ai/openrouter-free';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

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

// ── 1️⃣ Claude ────────────────────────────────────────────
/**
 * Claude, as a candidate list like the others (2026-10-08). It was one hardcoded id,
 * `claude-3-5-sonnet-20240620`, which Anthropic has since retired — so every request
 * paid a failed call here before falling through to Groq. The retired id stays LAST
 * (the pinning rule in models-pinned.test.ts: never drop an id production served); a
 * dead candidate costs one fast 404 and the walk continues.
 *
 * Current models think on every request and take `effort` instead of a thinking
 * budget: `low` suits a chat guide. Their safety classifiers can decline a request;
 * `fallbacks: "default"` lets the API re-run it on a fallback model inside the same
 * call. Both are sent only to current models — the retired one would reject them.
 */
export const CLAUDE_MODELS = [
  process.env.ANTHROPIC_MODEL,
  'claude-opus-5-5',
  'claude-3-5-sonnet-20240620',   // retired; kept last, see above
].filter(Boolean) as string[];

const LEGACY_CLAUDE = new Set(['claude-3-5-sonnet-20240620']);

/** Thinking spends from max_tokens on current models — give the answer room. */
const CLAUDE_MAX_TOKENS = Math.max(MAX_TOKENS, 8192);

export const callClaude = async (
  messages:     Message[],
  systemPrompt: string,
  apiKey:       string,
  signal?:      AbortSignal,
  attachments:  Attachment[] = [],
): Promise<ProviderResult> => {
  const lastUser = messages.map(m => m.role).lastIndexOf('user');
  const apiMessages = attachments.length && lastUser >= 0
    ? messages.map((m, i) => (i === lastUser ? { role: m.role, content: claudeContent(m.content, attachments) } : m))
    : messages;

  return withModelFallback('claude', CLAUDE_MODELS, (model) => {
    const legacy = LEGACY_CLAUDE.has(model);
    return fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      signal,
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        ...(legacy ? {} : { 'anthropic-beta': 'server-side-fallback-2026-07-01' }),
      },
      body: JSON.stringify({
        model,
        max_tokens: legacy ? MAX_TOKENS : CLAUDE_MAX_TOKENS,
        system:     systemPrompt,
        messages:   apiMessages,
        stream:     true,
        ...(legacy ? {} : { output_config: { effort: 'low' }, fallbacks: 'default' }),
      }),
    });
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
  // Verified by /api/ai/health on 2026-10-08: the ONLY Groq id still answering. Moved
  // to the head with that evidence — the pinned llama-3.1-8b-instant now returns
  // 404 model_not_found, and every request was paying for it first.
  'openai/gpt-oss-20b',
  // OpenAI's larger open-weight GPT on Groq's free tier (owner: "free models, add GPT").
  'openai/gpt-oss-120b',
  // Previously pinned by #154; 404 on 2026-10-08. Kept (never drop an id production
  // served) but demoted behind the verified one.
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  // Decommissioned per Groq (2026-10-08 health). Kept LAST: a retired id costs one fast
  // 400 and the walk continues.
  'gemma2-9b-it',
  'llama3-8b-8192',
  'llama3-70b-8192',
  'mixtral-8x7b-32768',
].filter(Boolean) as string[];

export const GEMINI_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-3.6-flash',          // pinned by #154 — verified again 2026-10-08 (1.1 s)
  'gemini-flash-latest',       // Google's own moving alias — verified 2026-10-08 (3.9 s)
  // Named by Google's own 404s on 2026-10-08 ("update your code to use
  // models/gemini-3.8-flash"). Not yet probed from here — below the verified two.
  'gemini-3.8-flash',
  'gemini-2.5-flash',          // 404 "no longer available to new users" (2026-10-08)
  'gemini-2.0-flash',          // 404 (2026-10-08)
  'gemini-1.5-flash',          // 404 (2026-10-08)
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
export type ProviderResult = { ok: true; res: Response } | ProviderFailure;

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
      /(not exist|not found|no endpoints found|unavailable for free|decommission|unsupported|no longer|access to it|not a valid model)/i.test(body)) {
    return 'model-gone';
  }
  // OpenRouter lists some `:free` models it then refuses with 403 "only available on
  // agentic harnesses" (production health, 2026-10-08). The key is fine — that one model
  // is closed to us, and the next candidate answered. Treating it as fatal ended the
  // walk on the first of them, before the working models were ever tried.
  if (status === 403 && /(agentic harness|not available to you|not allowed to use this model)/i.test(body)) {
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
export const callGroq = async (
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

// ── 4️⃣ OpenRouter — free GPT and others ──────────────────
/**
 * The free route to GPT (2026-10-08). OpenAI's own API has no free tier, and GitHub
 * Models — the free GPT endpoint people used — was retired in July 2026. OpenRouter
 * serves OpenAI's open-weight gpt-oss models (and others) under `:free` ids, on an
 * OpenAI-compatible API: ~20 requests/minute, and per day 50 on an account that never
 * bought credits, 1,000 once it has bought $10 at any time (OpenRouter's stated rule —
 * check their limits page; the free roster changes often, which is why this is a
 * candidate list and a retired id costs one fast 404).
 *
 * Text only here: which free models read images changes too often to promise it, and
 * Gemini already reads them for free.
 */
/**
 * The candidates are READ from OpenRouter's catalogue, not written here
 * (lib/ai/openrouter-free.ts): on 2026-10-08 every hardcoded `:free` id — gpt-oss-120b,
 * gpt-oss-20b, llama-3.3-70b, deepseek-chat-v3 — answered "unavailable for free" in
 * production the same day it was added. The env override still comes first.
 */
export async function openRouterCandidates(): Promise<string[]> {
  const env = process.env.OPENROUTER_MODEL;
  const free = await freeOpenRouterModels();
  return [...(env ? [env] : []), ...free.filter((m) => m !== env)];
}

export const callOpenRouter = async (
  messages:     Message[],
  systemPrompt: string,
  apiKey:       string,
  signal?:      AbortSignal,
): Promise<ProviderResult> =>
  withModelFallback('openrouter', await openRouterCandidates(), (model) =>
    fetch('https://openrouter.ai/api/v1/chat/completions', {
      method:  'POST',
      signal,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
        // OpenRouter's attribution headers — optional, they name the app in its dashboard.
        'HTTP-Referer':  'https://hub.tecosystem.app',
        'X-Title':       'TEC AI',
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
export const callGemini = async (
  messages:     Message[],
  systemPrompt: string,
  apiKey:       string,
  signal?:      AbortSignal,
  attachments:  Attachment[] = [],
): Promise<ProviderResult> => {
  const lastUser = messages.map(m => m.role).lastIndexOf('user');
  const geminiMessages = messages.map((m, i) => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: i === lastUser && attachments.length ? geminiParts(m.content, attachments) : [{ text: m.content }],
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
export function createUnifiedStream(provider: string) {
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
          } else if (provider === 'groq' || provider === 'openrouter') {
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
