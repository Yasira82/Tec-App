import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify }                 from 'jose';
import { GROQ_MODELS, GEMINI_MODELS } from '../chat/route';

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

export async function GET(req: NextRequest) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const claudeKey = process.env.ANTHROPIC_API_KEY;
  const groqKey   = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  const results: Record<string, ModelProbe[]> = {};

  if (claudeKey) {
    results.claude = [await probe('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         claudeKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620', max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    }, 'claude-3-5-sonnet-20240620')];
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

  const working = Object.entries(results).flatMap(([provider, probes]) =>
    probes.filter(p => p.ok).map(p => `${provider}:${p.model}`));

  return NextResponse.json({
    // The headline: is the assistant able to answer at all?
    healthy:    working.length > 0,
    working,
    // Named so the fix is obvious from the response itself.
    recommendation: working.length
      ? `Pin a winner: set GROQ_MODEL / GEMINI_MODEL to one of: ${working.join(', ')}`
      : 'No provider answered. Check the API keys, or that a key has quota left.',
    configured: {
      claude: !!claudeKey,
      groq:   !!groqKey,
      gemini: !!geminiKey,
    },
    results,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
