/**
 * Provider/model fallback behaviour under real failures seen in production.
 *
 * The August 21 outage log read:
 *   [AI] all providers failed: groq 400:  | gemini 503: {"message":"This model is
 *   currently experiencing high demand. Spikes in demand are usually temporary."}
 *
 * Two things are wrong in that one line, and both are covered here:
 *  - `groq 400:` has NO reason — the body was read twice, and the second read (the one
 *    that built the log) got an empty string.
 *  - gemini gave up after ONE model, even though "high demand" is temporary and three
 *    more candidates were sitting in the list unused.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const KEY = 'test-key';

/** Build a fetch mock that answers per-model, and records the models it was asked for. */
function modelRouter(answers: Record<string, { status: number; body?: string }>) {
  const asked: string[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    // Gemini carries the model in the path; Groq/Claude in the JSON body.
    const fromPath = /models\/([^:]+):/.exec(u)?.[1];
    const fromBody = init?.body ? (JSON.parse(String(init.body)) as { model?: string }).model : undefined;
    const model = fromPath ?? fromBody ?? 'unknown';
    asked.push(model);

    const a = answers[model] ?? answers['*'] ?? { status: 200 };
    if (a.status === 200) {
      return { ok: true, status: 200, body: new ReadableStream(), text: async () => '' } as unknown as Response;
    }
    let consumed = false;
    return {
      ok: false,
      status: a.status,
      // Mirrors the real Response contract: the body can be read ONCE. A second read
      // yields '' — exactly the trap that erased the groq 400 reason in production.
      text: async () => { if (consumed) return ''; consumed = true; return a.body ?? ''; },
    } as unknown as Response;
  });
  return { fetchMock, asked };
}

async function loadRoute() {
  vi.resetModules();
  return import('@/app/api/ai/chat/route');
}

beforeEach(() => {
  process.env.JWT_SECRET = 'x'.repeat(40);
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.GROQ_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.AI_OVERLOAD_RETRY_MS;
});

/** POST to the route with a valid session, returning the response. */
async function ask() {
  const { POST } = await loadRoute();
  const { SignJWT } = await import('jose');
  const token = await new SignJWT({ sub: 'u1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(process.env.JWT_SECRET!));

  const req = {
    headers:  { get: (h: string) => (h === 'authorization' ? `Bearer ${token}` : '') },
    cookies:  { get: () => undefined },
    json:     async () => ({ messages: [{ role: 'user', content: 'hi' }] }),
  } as unknown as import('next/server').NextRequest;

  return POST(req);
}

describe('model fallback', () => {
  it('walks to the next candidate when a model reports overload', async () => {
    process.env.GEMINI_API_KEY   = KEY;
    process.env.AI_OVERLOAD_RETRY_MS = '1';
    const { fetchMock, asked } = modelRouter({
      'gemini-flash-latest': { status: 503, body: '{"message":"This model is currently experiencing high demand."}' },
      '*':                   { status: 200 },
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await ask();
    expect(res.status).toBe(200);
    // It did NOT stop at the overloaded model — a sibling answered.
    expect(asked.length).toBeGreaterThan(1);
    expect(asked[0]).toBe('gemini-flash-latest');
  });

  it('retries the whole list once when every candidate is overloaded', async () => {
    process.env.GEMINI_API_KEY = KEY;
    process.env.AI_OVERLOAD_RETRY_MS = '1';
    const { fetchMock, asked } = modelRouter({
      '*': { status: 503, body: 'high demand — try again later' },
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await ask();
    const body = await res.json() as { code?: string; error?: string; detail?: string };

    // Every model tried twice: "spikes in demand are usually temporary" is worth one retry.
    expect(asked.length).toBeGreaterThanOrEqual(8);
    // And the user is told it is BUSY, not that the assistant is switched off.
    expect(body.code).toBe('BUSY');
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('5');
  });

  it('stops immediately on a fatal error — another model cannot fix a bad key', async () => {
    process.env.GEMINI_API_KEY = KEY;
    const { fetchMock, asked } = modelRouter({
      '*': { status: 401, body: 'API key not valid' },
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await ask();
    expect(asked).toHaveLength(1);
    expect(res.status).toBe(502);
    const body = await res.json() as { code?: string };
    expect(body.code).toBe('PROVIDERS_FAILED');
  });

  it('keeps walking past a retired model id', async () => {
    process.env.GEMINI_API_KEY = KEY;
    const { fetchMock, asked } = modelRouter({
      'gemini-flash-latest': { status: 404, body: 'The model `x` does not exist or you do not have access to it' },
      '*':                   { status: 200 },
    });
    vi.stubGlobal('fetch', fetchMock);

    expect((await ask()).status).toBe(200);
    expect(asked.length).toBeGreaterThan(1);
  });
});

describe('failure reporting', () => {
  // THE regression: the reason was read once for classification and again for the log,
  // and the second read returned ''. Production logged `groq 400:` and told us nothing.
  it('reports the provider reason instead of an empty string', async () => {
    process.env.GROQ_API_KEY = KEY;
    const { fetchMock } = modelRouter({
      '*': { status: 400, body: 'decommissioned: this model is no longer supported' },
    });
    vi.stubGlobal('fetch', fetchMock);

    const body = await (await ask()).json() as { detail?: string };
    expect(body.detail).toContain('no longer supported');
    // and it names WHICH model failed — "groq 400" alone is not actionable
    expect(body.detail).toMatch(/\[[^\]]+\]/);
  });

  it('never shows the raw provider payload as the user-facing message', async () => {
    process.env.GROQ_API_KEY = KEY;
    const { fetchMock } = modelRouter({ '*': { status: 400, body: '{"error":{"code":"internal_ugly"}}' } });
    vi.stubGlobal('fetch', fetchMock);

    const body = await (await ask()).json() as { error?: string };
    expect(body.error).not.toContain('internal_ugly');
    expect(body.error).toMatch(/try again/i);
  });

  it('says NOT_CONFIGURED — distinctly from BUSY — when no provider key exists', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const res  = await ask();
    const body = await res.json() as { code?: string };
    expect(body.code).toBe('NOT_CONFIGURED');
  });
});

describe('/api/ai/health diagnostic', () => {
  async function health(token?: string) {
    vi.resetModules();
    const { GET } = await import('@/app/api/ai/health/route');
    const req = {
      headers: { get: (h: string) => (h === 'authorization' && token ? `Bearer ${token}` : '') },
      cookies: { get: () => undefined },
    } as unknown as import('next/server').NextRequest;
    return GET(req);
  }

  async function signed() {
    const { SignJWT } = await import('jose');
    return new SignJWT({ sub: 'u1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET!));
  }

  it('requires a session — probes cost money', async () => {
    expect((await health()).status).toBe(401);
  });

  it('names the models that actually answer, and how to pin one', async () => {
    process.env.GROQ_API_KEY = KEY;
    const { fetchMock } = modelRouter({
      'llama-3.3-70b-versatile': { status: 400, body: 'decommissioned, no longer supported' },
      '*':                       { status: 200 },
    });
    vi.stubGlobal('fetch', fetchMock);

    const body = await (await health(await signed())).json() as {
      healthy: boolean; working: string[]; recommendation: string;
    };
    expect(body.healthy).toBe(true);
    expect(body.working).toContain('groq:llama-3.1-8b-instant');
    expect(body.working).not.toContain('groq:llama-3.3-70b-versatile');
    expect(body.recommendation).toContain('GROQ_MODEL');
  });

  it('reports each failure reason instead of a bare status', async () => {
    process.env.GROQ_API_KEY = KEY;
    const { fetchMock } = modelRouter({ '*': { status: 400, body: 'model has been decommissioned' } });
    vi.stubGlobal('fetch', fetchMock);

    const body = await (await health(await signed())).json() as {
      healthy: boolean; results: Record<string, { reason?: string }[]>;
    };
    expect(body.healthy).toBe(false);
    expect(body.results.groq[0].reason).toContain('decommissioned');
  });
});
