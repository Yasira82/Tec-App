import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify }                 from 'jose';
import { CLAUDE_MODELS, GROQ_MODELS, GEMINI_MODELS, openRouterCandidates } from '../chat/route';
import { TEC_SYSTEM_PROMPT } from '@/lib/ai/tec-ai-system-prompt';

export const runtime = 'edge';

/**
 * Which AI provider and model actually work right now.
 *
 * This exists because the same class of outage has now hit three times — a model id gets
 * retired, or a provider is overloaded — and each time the only way to find out WHICH
 * model still answers was to ship a guess and wait for a user to report the failure. That
 * loop is expensive and slow, and it burns the user's trust while it runs.
 *
 * So: probe every configured provider with a one-token request and report, per model,
 * whether it answers. No guessing. Pin the winner with GROQ_MODEL / GEMINI_MODEL and the
 * chat route uses it first, without a deploy.
 *
 * Auth-gated exactly like the chat route: probes cost money, so signed-in TEC users only.
 * Read-only — it never mutates anything and never touches the chat path's state.
 */

interface ModelProbe {
  model:  string;
  ok:     boolean;
  status: number;
  reason?: string;
  ms:     number;
}

async function authenticate(req: NextRequest): Promise<string | null> {
  const bearer = req.headers.get('authorization');
  const token  = bearer?.startsWith('Bearer ')
    ? bearer.slice(7)
    : req.cookies?.get?.('tec_access_token')?.value;
  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) return null;   // fail closed — no secret, no trust

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
    });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/** One tiny non-streaming call. `max_tokens: 1` keeps a full probe close to free. */
async function probe(url: string, init: RequestInit, model: string): Promise<ModelProbe> {
  const started = Date.now();
  try {
    const res = await fetch(url, init);
    const ms  = Date.now() - started;
    if (res.ok) return { model, ok: true, status: res.status, ms };
    const body = await res.text().catch(() => '');
    return {
      model, ok: false, status: res.status, ms,
      reason: body.replace(/\s+/g, ' ').slice(0, 180),
    };
  } catch (e) {
    return {
      model, ok: false, status: 0, ms: Date.now() - started,
      reason: ((e as Error)?.message ?? 'network error').slice(0, 120),
    };
  }
}

/**
 * A 32×32 amber PNG — a real image, a few hundred bytes. `?images=1` sends it to each
 * Gemini model the way the chat does (the full system prompt, streaming, the image
 * before the words) and times the wait for the first bytes.
 *
 * Why: photos go to Gemini only (Groq/OpenRouter read text; Claude is unset), and on
 * 2026-10-09 three screenshots got "temporarily unavailable" while text worked. Either a
 * model refuses images, or it takes longer than the chat's 20-second budget to start
 * answering with them. This says which, per model, instead of a guess.
 */
const PROBE_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKklEQVR42u3NMQ0AAAgDsOlDL+q4UMFB0qR/M12nIhAIBAKBQCAQCL4EC5iN4GrrYEkVAAAAAElFTkSuQmCC';

/** Time to the first streamed bytes — the moment the chat route stops its clock. */
async function probeFirstBytes(url: string, init: RequestInit, model: string): Promise<ModelProbe> {
  const started = Date.now();
  try {
    const res = await fetch(url, init);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { model, ok: false, status: res.status, ms: Date.now() - started, reason: body.replace(/\s+/g, ' ').slice(0, 180) };
    }
    const reader = res.body?.getReader();
    await reader?.read();
    void reader?.cancel().catch(() => {});
    return { model, ok: true, status: res.status, ms: Date.now() - started };
  } catch (e) {
    return { model, ok: false, status: 0, ms: Date.now() - started, reason: ((e as Error)?.message ?? 'network error').slice(0, 120) };
  }
}

export async function GET(req: NextRequest) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const claudeKey = process.env.ANTHROPIC_API_KEY;
  const groqKey   = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  const results: Record<string, ModelProbe[]> = {};

  if (claudeKey) {
    results.claude = [];
    for (const model of CLAUDE_MODELS) {
      results.claude.push(await probe('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         claudeKey,
          'anthropic-version': '2023-06-01',
        },
        // 16, not 1: current models think on every request and spend from max_tokens.
        body: JSON.stringify({ model, max_tokens: 16, messages: [{ role: 'user', content: 'hi' }] }),
      }, model));
    }
  }

  if (groqKey) {
    results.groq = [];
    for (const model of GROQ_MODELS) {
      results.groq.push(await probe('https://api.groq.com/openai/v1/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
        body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
      }, model));
    }
  }

  if (openrouterKey) {
    results.openrouter = [];
    // Read from OpenRouter's catalogue — the same list the chat route walks.
    for (const model of await openRouterCandidates()) {
      results.openrouter.push(await probe('https://openrouter.ai/api/v1/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openrouterKey}` },
        body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
      }, model));
    }
  }

  if (geminiKey) {
    results.gemini = [];
    for (const model of GEMINI_MODELS) {
      results.gemini.push(await probe(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents:         [{ role: 'user', parts: [{ text: 'hi' }] }],
            generationConfig: { maxOutputTokens: 1 },
          }),
        }, model));
    }
  }

  // Photos: opt-in (`?images=1`), Gemini only — the one provider the chat sends them to.
  // A URL that does not parse is simply no `?images=1` — never a crashed health check.
  let withImages = false;
  try { withImages = new URL(req.url).searchParams.get('images') === '1'; } catch { /* plain check */ }
  let images: ModelProbe[] | undefined;
  if (withImages && geminiKey) {
    images = [];
    for (const model of GEMINI_MODELS) {
      images.push(await probeFirstBytes(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${geminiKey}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: TEC_SYSTEM_PROMPT }] },
            contents: [{ role: 'user', parts: [
              { inline_data: { mime_type: 'image/png', data: PROBE_IMAGE } },
              { text: 'What colour is this picture? One word.' },
            ] }],
            generationConfig: { maxOutputTokens: 16 },
          }),
        }, model));
    }
  }

  const working = Object.entries(results).flatMap(([provider, probes]) =>
    probes.filter(p => p.ok).map(p => `${provider}:${p.model}`));

  return NextResponse.json({
    // The headline: is the assistant able to answer at all?
    healthy:    working.length > 0,
    working,
    // Named so the fix is obvious from the response itself.
    recommendation: working.length
      ? `Pin a winner: set GEMINI_MODEL / GROQ_MODEL / OPENROUTER_MODEL / ANTHROPIC_MODEL to one of: ${working.join(', ')}`
      : 'No provider answered. Check the API keys, or that a key has quota left.',
    configured: {
      claude: !!claudeKey,
      groq:   !!groqKey,
      gemini: !!geminiKey,
      openrouter: !!openrouterKey,
    },
    results,
    ...(images ? {
      images: {
        // The chat gives Gemini 20 s to START answering when a photo is attached.
        budgetMs: 20_000,
        working:  images.filter(p => p.ok && p.ms < 20_000).map(p => p.model),
        results:  images,
      },
    } : {}),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
