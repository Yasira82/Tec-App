/**
 * Extra API route tests:
 *   - app/api/auth/sso/route.ts
 *   - app/api/commerce/orders/route.ts
 *   - app/api/ai/chat/route.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── jose mock ────────────────────────────────────────────────────
vi.mock('jose', () => {
  class MockSignJWT {
    setProtectedHeader() { return this; }
    setSubject()         { return this; }
    setIssuer()          { return this; }
    setAudience()        { return this; }
    setJti()             { return this; }
    setExpirationTime()  { return this; }
    setIssuedAt()        { return this; }
    async sign()         { return 'mock-sso-token'; }
  }
  return {
    jwtVerify: vi.fn().mockResolvedValue({ payload: {}, protectedHeader: {} }),
    SignJWT:   MockSignJWT,
  };
});

// ── ai system prompt mock ────────────────────────────────────────
vi.mock('@/lib/ai/tec-ai-system-prompt', () => ({
  TEC_SYSTEM_PROMPT: 'You are TEC AI assistant.',
}));

// ── helpers ──────────────────────────────────────────────────────
function makeReq(opts: {
  method?:    string;
  url?:       string;
  search?:    string;
  cookies?:   Record<string, string>;
  headers?:   Record<string, string | null>;
  body?:      unknown;
}): NextRequest {
  const url    = opts.url ?? 'http://localhost/api/test';
  const search = opts.search ?? '';
  return {
    method:  opts.method ?? 'GET',
    url,
    nextUrl: {
      origin:       'http://localhost:3000',
      pathname:     '/api/test',
      search,
      searchParams: new URLSearchParams(search),
    },
    cookies: {
      get: (name: string) => {
        const v = (opts.cookies ?? {})[name];
        return v !== undefined ? { value: v } : undefined;
      },
    },
    headers: {
      get: (name: string) => {
        return (opts.headers ?? {})[name] ?? null;
      },
    },
    json: async () => opts.body ?? {},
  } as unknown as NextRequest;
}

const okFetch   = (data: unknown = {}, status = 200) =>
  Promise.resolve({ ok: true, status, json: async () => data } as Response);
const failFetch = (status = 503) =>
  Promise.resolve({ ok: false, status, json: async () => ({}) } as Response);

beforeEach(() => {
  process.env.API_GATEWAY_URL = 'https://gw.test';
  process.env.SSO_SECRET      = 'sso-secret-32-chars-long-xxxxxxx';
  process.env.JWT_SECRET      = 'jwt-secret-32-chars-long-xxxxxxx';
  vi.clearAllMocks();
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => okFetch());
});

// ═══════════════════════════════════════════════════════════════
// SSO Route
// ═══════════════════════════════════════════════════════════════
describe('GET /api/auth/sso', () => {
  it('redirects to / if no access token', async () => {
    const { GET } = await import('@/app/api/auth/sso/route');
    const req = makeReq({ cookies: {} });
    const res = await GET(req);
    expect(res.status).toBe(307);
  });

  it('redirects to / if no user cookie', async () => {
    const { GET } = await import('@/app/api/auth/sso/route');
    const req = makeReq({ cookies: { tec_access_token: 'tok' } });
    const res = await GET(req);
    expect(res.status).toBe(307);
  });

  it('returns 400 if no target param', async () => {
    const { GET } = await import('@/app/api/auth/sso/route');
    const req = makeReq({
      cookies: { tec_access_token: 'tok', tec_user: encodeURIComponent(JSON.stringify({ id: 'u1' })) },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid target', async () => {
    const { GET } = await import('@/app/api/auth/sso/route');
    const req = makeReq({
      cookies: { tec_access_token: 'tok', tec_user: encodeURIComponent(JSON.stringify({ id: 'u1' })) },
      search:  '?target=https://evil.com',
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_target');
  });

  it('returns 503 if SSO_SECRET not set', async () => {
    delete process.env.SSO_SECRET;
    const { GET } = await import('@/app/api/auth/sso/route');
    const req = makeReq({
      cookies: { tec_access_token: 'tok', tec_user: encodeURIComponent(JSON.stringify({ id: 'u1' })) },
      search:  '?target=https://hub.tecosystem.app/profile',
    });
    const res = await GET(req);
    expect(res.status).toBe(503);
    process.env.SSO_SECRET = 'sso-secret-32-chars-long-xxxxxxx';
  });

  it('redirects to SSO callback on success', async () => {
    const { GET } = await import('@/app/api/auth/sso/route');
    const userObj = { id: 'u1', piUsername: 'alice' };
    const req = makeReq({
      cookies: {
        tec_access_token: 'valid-tok',
        tec_user:         encodeURIComponent(JSON.stringify(userObj)),
      },
      search:  '?target=https://hub.tecosystem.app/profile',
      headers: { cookie: 'tec_access_token=valid-tok' },
    });
    const res = await GET(req);
    expect(res.status).toBe(307);
    const loc = res.headers.get('location') ?? '';
    expect(loc).toContain('sso-callback');
    expect(loc).toContain('token=mock-sso-token');
  });

  it('redirects with redirect param when target has a path', async () => {
    const { GET } = await import('@/app/api/auth/sso/route');
    const userObj = { id: 'u1' };
    const req = makeReq({
      cookies: {
        tec_access_token: 'valid-tok',
        tec_user:         encodeURIComponent(JSON.stringify(userObj)),
      },
      search: '?target=https://hub.tecosystem.app/dashboard?tab=wallet',
    });
    const res = await GET(req);
    expect(res.status).toBe(307);
  });

  it('refreshes token when jwtVerify fails', async () => {
    const joseModule = await import('jose');
    vi.mocked(joseModule.jwtVerify).mockRejectedValueOnce(new Error('expired'));
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, json: async () => ({ token: 'new-tok' }),
    } as Response);

    const { GET } = await import('@/app/api/auth/sso/route');
    const req = makeReq({
      cookies: {
        tec_access_token: 'expired-tok',
        tec_user:         encodeURIComponent(JSON.stringify({ id: 'u1' })),
        tec_csrf:         'csrf-tok',
      },
      search:  '?target=https://hub.tecosystem.app',
      headers: { cookie: 'tec_access_token=expired-tok' },
    });
    const res = await GET(req);
    expect(res.status).toBe(307);
  });
});

// ═══════════════════════════════════════════════════════════════
// Commerce Orders Route
// ═══════════════════════════════════════════════════════════════
describe('commerce/orders route', () => {
  describe('GET', () => {
    it('returns 401 if no Authorization header', async () => {
      const { GET } = await import('@/app/api/commerce/orders/route');
      const req = makeReq({});
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it('returns gateway data on success', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        okFetch({ data: [{ id: 'o1' }] })
      );
      const { GET } = await import('@/app/api/commerce/orders/route');
      const req = makeReq({ headers: { authorization: 'Bearer tok' } });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
    });

    it('returns 503 on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const { GET } = await import('@/app/api/commerce/orders/route');
      const req = makeReq({ headers: { authorization: 'Bearer tok' } });
      const res = await GET(req);
      expect(res.status).toBe(503);
    });

    it('passes search params to gateway', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(okFetch({ data: [] }));
      const { GET } = await import('@/app/api/commerce/orders/route');
      const req = makeReq({ headers: { authorization: 'Bearer tok' }, search: '?page=2' });
      await GET(req);
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('page=2');
    });
  });

  describe('POST', () => {
    it('returns 401 if no Authorization header', async () => {
      const { POST } = await import('@/app/api/commerce/orders/route');
      const req = makeReq({ method: 'POST', body: { product_id: 'p1' } });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('creates order via gateway', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(okFetch({ data: { id: 'order-1' } }, 201));
      const { POST } = await import('@/app/api/commerce/orders/route');
      const req = makeReq({
        method:  'POST',
        headers: { authorization: 'Bearer tok' },
        body:    { items: [{ productId: 'p1', qty: 1 }] },
      });
      const res  = await POST(req);
      const body = await res.json();
      expect(body.data.id).toBe('order-1');
    });

    it('returns 503 on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));
      const { POST } = await import('@/app/api/commerce/orders/route');
      const req = makeReq({
        method:  'POST',
        headers: { authorization: 'Bearer tok' },
        body:    {},
      });
      const res = await POST(req);
      expect(res.status).toBe(503);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// AI Chat Route
// ═══════════════════════════════════════════════════════════════
describe('AI chat route', () => {
  const makeAiReq = (opts: {
    ip?:     string;
    origin?: string;
    body?:   unknown;
    method?: string;
  } = {}): NextRequest => ({
    method:  opts.method ?? 'POST',
    url:     'http://localhost/api/ai/chat',
    nextUrl: {
      origin:       'http://localhost:3000',
      pathname:     '/api/ai/chat',
      searchParams: new URLSearchParams(),
    },
    headers: {
      get: (name: string) => {
        if (name === 'x-forwarded-for') return opts.ip ?? '10.0.0.1';
        if (name === 'origin')          return opts.origin ?? 'http://localhost:3000';
        // Authenticated by default — token keyed to the ip so each unique-ip test
        // maps to a distinct user (the route rate-limits per user, not per ip).
        if (name === 'authorization')   return `Bearer tok-${opts.ip ?? '10.0.0.1'}`;
        return null;
      },
    },
    cookies: { get: () => undefined },
    json: async () => opts.body ?? { messages: [{ role: 'user', content: 'Hello' }] },
  } as unknown as NextRequest);

  beforeEach(async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    // The route auth-gates via jose. Make jwtVerify resolve a user id FROM the token
    // so the per-user rate limiter stays isolated per test (token is keyed to ip above).
    const { jwtVerify } = await import('jose');
    (jwtVerify as unknown as { mockImplementation: (fn: (t: string) => Promise<unknown>) => void })
      .mockImplementation(async (token: string) => ({ payload: { sub: `user-${token}` } }));
  });

  it('OPTIONS returns 204 with CORS headers', async () => {
    const { OPTIONS } = await import('@/app/api/ai/chat/route');
    const req = makeAiReq({ method: 'OPTIONS', origin: 'http://localhost:3000' });
    const res = await OPTIONS(req);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('POST returns 400 if no messages', async () => {
    const { POST } = await import('@/app/api/ai/chat/route');
    const req = makeAiReq({ body: { messages: [] }, ip: '10.1.0.1' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('messages');
  });

  it('POST returns 400 for single message shorthand with no content', async () => {
    const { POST } = await import('@/app/api/ai/chat/route');
    const req = makeAiReq({ body: {}, ip: '10.1.0.2' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('POST returns 503 if no AI keys configured', async () => {
    const { POST } = await import('@/app/api/ai/chat/route');
    const req = makeAiReq({ ip: '10.1.0.3' });
    const res = await POST(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain('not configured');
  });

  it('POST returns 502 when all providers fail', async () => {
    process.env.ANTHROPIC_API_KEY = 'claude-key';
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(failFetch(500));
    const { POST } = await import('@/app/api/ai/chat/route');
    const req = makeAiReq({ ip: '10.1.0.4' });
    const res = await POST(req);
    expect(res.status).toBe(502);
  });

  it('POST returns 429 when rate limit exceeded', async () => {
    const { POST } = await import('@/app/api/ai/chat/route');
    const ip = '192.168.99.99';
    // exhaust the rate limit (20 requests allowed)
    for (let i = 0; i < 20; i++) {
      await POST(makeAiReq({ ip }));
    }
    const res = await POST(makeAiReq({ ip }));
    expect(res.status).toBe(429);
  });

  it('POST returns streaming response when Claude succeeds', async () => {
    process.env.ANTHROPIC_API_KEY = 'claude-key';
    const sseData = 'data: {"type":"content_block_delta","delta":{"text":"Hi"}}\n\ndata: [DONE]\n\n';
    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(c) { c.enqueue(encoder.encode(sseData)); c.close(); },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200, body: mockStream,
    } as unknown as Response);

    const { POST } = await import('@/app/api/ai/chat/route');
    const req = makeAiReq({ ip: '10.1.0.5' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    expect(res.headers.get('X-AI-Provider')).toBe('claude');
  });

  it('POST falls back to Groq when Claude fails', async () => {
    process.env.ANTHROPIC_API_KEY = 'claude-key';
    process.env.GROQ_API_KEY      = 'groq-key';
    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(c) {
        c.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'));
        c.close();
      },
    });
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(failFetch(500))        // Claude fails
      .mockResolvedValueOnce({ ok: true, status: 200, body: mockStream } as unknown as Response);

    const { POST } = await import('@/app/api/ai/chat/route');
    const req = makeAiReq({ ip: '10.1.0.6' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-AI-Provider')).toBe('groq');
  });

  it('POST supports single message shorthand', async () => {
    process.env.GROQ_API_KEY = 'groq-key';
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(failFetch(500));
    const { POST } = await import('@/app/api/ai/chat/route');
    const req = makeAiReq({ body: { message: 'Hello' }, ip: '10.1.0.7' });
    const res = await POST(req);
    // providers fail but path was taken (502)
    expect(res.status).toBe(502);
  });

  it('POST includes user context in system prompt', async () => {
    process.env.ANTHROPIC_API_KEY = 'claude-key';
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(failFetch(500));
    const { POST } = await import('@/app/api/ai/chat/route');
    const req = makeAiReq({
      body: { messages: [{ role: 'user', content: 'Hi' }], userContext: { username: 'alice', balance: 5, locale: 'ar' } },
      ip: '10.1.0.8',
    });
    await POST(req);
    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(body.system).toContain('@alice');
  });

  it('POST handles JSON parse error gracefully', async () => {
    const { POST } = await import('@/app/api/ai/chat/route');
    const badReq = {
      ...makeAiReq({ ip: '10.1.0.9' }),
      json: async () => { throw new Error('bad json'); },
    } as unknown as NextRequest;
    const res = await POST(badReq);
    expect(res.status).toBe(500);
  });

  it('OPTIONS allows localhost origin', async () => {
    const { OPTIONS } = await import('@/app/api/ai/chat/route');
    const req = makeAiReq({ method: 'OPTIONS', origin: 'http://localhost:5173' });
    const res = await OPTIONS(req);
    const origin = res.headers.get('Access-Control-Allow-Origin');
    expect(origin).toBe('http://localhost:5173');
  });

  it('OPTIONS blocks disallowed origin', async () => {
    const { OPTIONS } = await import('@/app/api/ai/chat/route');
    const req = makeAiReq({ method: 'OPTIONS', origin: 'https://evil.com' });
    const res = await OPTIONS(req);
    const origin = res.headers.get('Access-Control-Allow-Origin');
    expect(origin).toBe('');
  });
});
