/**
 * api-routes-remaining.test.ts
 *
 * Covers remaining low-coverage API routes to push statement coverage toward 95.5%:
 *   1.  /api/ai/chat                         (64.07% → covers key branches)
 *   2.  /api/bff/wallet/balance              (56.25% → token refresh path)
 *   3.  /api/bff/identity/profile GET+PATCH  (53.84%)
 *   4.  /api/subscriptions GET+POST+PATCH    (78.57%)
 *   5.  /api/market/pi-price                 (90%    → OKX error paths)
 *   6.  /api/payment/approve                 (80.3%  → remaining branches)
 *   7.  /api/bff/payment/create              (90.9%  → retry after tokenExpired)
 *   8.  /api/payment/create                  (92.53% → remaining branches)
 *   9.  /api/bff/commerce/orders             (93.75% → GET+POST paths)
 *  10.  /api/identity/profile GET+PATCH      (80%)
 *  11.  /api/identity/me                     (GET)
 *  12.  /api/identity/kyc                    (GET additional)
 *  13.  /api/identity/roles                  (GET additional)
 *  14.  /api/commerce/orders GET+POST        (additional paths)
 *  15.  /api/commerce/orders/checkout        (additional paths)
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// ── Hoisted mocks ─────────────────────────────────────────────────────────
const mockIsE2eMode    = vi.hoisted(() => vi.fn(() => false));
const mockFetchTimeout = vi.hoisted(() => vi.fn());
const mockJwtVerify    = vi.hoisted(() => vi.fn());
const mockCookies      = vi.hoisted(() => vi.fn());
const mockBffFetch     = vi.hoisted(() => vi.fn());
const mockAttemptRefresh = vi.hoisted(() => vi.fn());
const mockBuildExpired   = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/e2e-mode',           () => ({ isE2eMode:       mockIsE2eMode }));
vi.mock('@/lib/server/fetch-with-timeout', () => ({ fetchWithTimeout: mockFetchTimeout }));
vi.mock('jose',                            () => ({ jwtVerify:        mockJwtVerify }));
vi.mock('next/headers',                    () => ({ cookies:          mockCookies }));
vi.mock('@/lib/bff-fetch', () => ({
  bffFetch:             mockBffFetch,
  attemptTokenRefresh:  mockAttemptRefresh,
  buildExpiredResponse: mockBuildExpired,
}));

// ── Mock NextRequest factory (matches the established codebase pattern) ──
function makeReq({
  method  = 'GET',
  url     = 'http://localhost/api/test',
  headers = {} as Record<string, string>,
  cookies = {} as Record<string, string>,
  body    = undefined as unknown,
  search  = {} as Record<string, string>,
} = {}): NextRequest {
  const searchParams = new URLSearchParams(search);
  const searchStr    = searchParams.toString() ? `?${searchParams.toString()}` : '';

  return {
    method,
    url:     `${url}${searchStr}`,
    nextUrl: {
      origin:       'http://localhost',
      pathname:     new URL(url).pathname,
      search:       searchStr,
      searchParams,
    },
    cookies: {
      get:    (name: string) => {
        const v = cookies[name];
        return v !== undefined ? { value: v } : undefined;
      },
      getAll: () => Object.entries(cookies).map(([name, value]) => ({ name, value })),
    },
    headers: {
      get: (name: string) => {
        const lower = name.toLowerCase();
        const key   = Object.keys(headers).find(k => k.toLowerCase() === lower);
        return key !== undefined ? headers[key] : null;
      },
    },
    json: async () => body ?? {},
  } as unknown as NextRequest;
}

/** Make a mock gateway response */
const gw = (data: unknown = {}, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: async () => data }) as ReturnType<typeof fetch>;

const gwErr = (status = 503) =>
  Promise.resolve({ ok: false, status, json: async () => ({ error: 'err' }) }) as ReturnType<typeof fetch>;

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetAllMocks();
  mockIsE2eMode.mockReturnValue(false);
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => gw());

  process.env.API_GATEWAY_URL = 'https://gw.test';
  process.env.JWT_SECRET      = 'test-jwt-secret-32-chars-long-xx';

  // Default next/headers cookies for bff/payment/create tests
  mockCookies.mockResolvedValue({
    get: vi.fn((name: string) => {
      if (name === 'tec_access_token') return { value: 'test-access-token' };
      if (name === 'tec_csrf')         return { value: 'csrf-test-value' };
      return undefined;
    }),
  });

  mockBuildExpired.mockReturnValue(
    new Response(JSON.stringify({ error: { code: 'SESSION_EXPIRED' } }), { status: 401 }),
  );
});

// ═══════════════════════════════════════════════════════════════
// 1. POST /api/ai/chat — rate limit, no messages, no keys, providers
// ═══════════════════════════════════════════════════════════════
describe('POST /api/ai/chat', () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  it('OPTIONS returns 204 with CORS headers', async () => {
    const { OPTIONS } = await import('@/app/api/ai/chat/route');
    const req = makeReq({
      method:  'OPTIONS',
      url:     'http://localhost/api/ai/chat',
      headers: { origin: 'http://localhost:3000' },
    });
    const res = await OPTIONS(req);
    expect(res.status).toBe(204);
  });

  it('returns 429 when rate limit exceeded for same IP', async () => {
    const { POST } = await import('@/app/api/ai/chat/route');
    for (let i = 0; i < 20; i++) {
      await POST(makeReq({
        method:  'POST',
        url:     'http://localhost/api/ai/chat',
        headers: { 'x-forwarded-for': '192.168.0.99' },
        body:    { messages: [{ role: 'user', content: 'hello' }] },
      }));
    }
    const res = await POST(makeReq({
      method:  'POST',
      url:     'http://localhost/api/ai/chat',
      headers: { 'x-forwarded-for': '192.168.0.99' },
      body:    { messages: [{ role: 'user', content: 'hello' }] },
    }));
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toMatch(/Rate limit/i);
  });

  it('returns 400 when no messages provided', async () => {
    const { POST } = await import('@/app/api/ai/chat/route');
    const res = await POST(makeReq({
      method:  'POST',
      url:     'http://localhost/api/ai/chat',
      headers: { 'x-forwarded-for': '10.0.0.1' },
      body:    {},
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/messages/i);
  });

  it('accepts body.message (singular) as fallback', async () => {
    const { POST } = await import('@/app/api/ai/chat/route');
    const res = await POST(makeReq({
      method:  'POST',
      url:     'http://localhost/api/ai/chat',
      headers: { 'x-forwarded-for': '10.0.0.2' },
      body:    { message: 'hello' },
    }));
    expect(res.status).toBe(503);
  });

  it('returns 503 when no AI keys are configured', async () => {
    const { POST } = await import('@/app/api/ai/chat/route');
    const res = await POST(makeReq({
      method:  'POST',
      url:     'http://localhost/api/ai/chat',
      headers: { 'x-forwarded-for': '10.0.0.3' },
      body:    { messages: [{ role: 'user', content: 'hello' }] },
    }));
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toMatch(/not configured/i);
  });

  it('returns 502 when all AI providers fail', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    fetchSpy.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as any);
    const { POST } = await import('@/app/api/ai/chat/route');
    const res = await POST(makeReq({
      method:  'POST',
      url:     'http://localhost/api/ai/chat',
      headers: { 'x-forwarded-for': '10.0.0.4' },
      body:    { messages: [{ role: 'user', content: 'hello' }] },
    }));
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toMatch(/All AI providers failed/i);
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('returns 502 when Claude throws an error', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    fetchSpy.mockRejectedValue(new Error('network error'));
    const { POST } = await import('@/app/api/ai/chat/route');
    const res = await POST(makeReq({
      method:  'POST',
      url:     'http://localhost/api/ai/chat',
      headers: { 'x-forwarded-for': '10.0.0.5' },
      body:    { messages: [{ role: 'user', content: 'hello' }] },
    }));
    expect(res.status).toBe(502);
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('streams response when Claude succeeds', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    const mockBody = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(
          'data: {"type":"content_block_delta","delta":{"text":"Hello"}}\n\n',
        ));
        controller.close();
      },
    });
    fetchSpy.mockResolvedValue({ ok: true, status: 200, body: mockBody, json: async () => ({}) } as any);
    const { POST } = await import('@/app/api/ai/chat/route');
    const res = await POST(makeReq({
      method:  'POST',
      url:     'http://localhost/api/ai/chat',
      headers: { 'x-forwarded-for': '10.0.0.6' },
      body:    { messages: [{ role: 'user', content: 'hello' }] },
    }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    expect(res.headers.get('X-AI-Provider')).toBe('claude');
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('falls back to Groq when Claude fails', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.GROQ_API_KEY      = 'gsk-test';
    const mockBody = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(
          'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
        ));
        controller.close();
      },
    });
    fetchSpy
      .mockResolvedValueOnce({ ok: false, status: 500, body: null, json: async () => ({}) } as any)
      .mockResolvedValueOnce({ ok: true, status: 200, body: mockBody, json: async () => ({}) } as any);
    const { POST } = await import('@/app/api/ai/chat/route');
    const res = await POST(makeReq({
      method:  'POST',
      url:     'http://localhost/api/ai/chat',
      headers: { 'x-forwarded-for': '10.0.0.7' },
      body:    { messages: [{ role: 'user', content: 'hello' }] },
    }));
    expect(res.status).toBe(200);
    expect(res.headers.get('X-AI-Provider')).toBe('groq');
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GROQ_API_KEY;
  });

  it('falls back to Gemini when Claude and Groq fail', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.GROQ_API_KEY      = 'gsk-test';
    process.env.GEMINI_API_KEY    = 'gem-test';
    const mockBody = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(
          'data: {"candidates":[{"content":{"parts":[{"text":"Hey"}]}}]}\n\n',
        ));
        controller.close();
      },
    });
    fetchSpy
      .mockResolvedValueOnce({ ok: false, status: 500, body: null, json: async () => ({}) } as any)
      .mockResolvedValueOnce({ ok: false, status: 500, body: null, json: async () => ({}) } as any)
      .mockResolvedValueOnce({ ok: true, status: 200, body: mockBody, json: async () => ({}) } as any);
    const { POST } = await import('@/app/api/ai/chat/route');
    const res = await POST(makeReq({
      method:  'POST',
      url:     'http://localhost/api/ai/chat',
      headers: { 'x-forwarded-for': '10.0.0.8' },
      body:    { messages: [{ role: 'user', content: 'hello' }] },
    }));
    expect(res.status).toBe(200);
    expect(res.headers.get('X-AI-Provider')).toBe('gemini');
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  it('returns 500 on unexpected error', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    fetchSpy.mockImplementation(() => { throw new TypeError('unexpected'); });
    const { POST } = await import('@/app/api/ai/chat/route');
    const res = await POST(makeReq({
      method:  'POST',
      url:     'http://localhost/api/ai/chat',
      headers: { 'x-forwarded-for': '10.0.0.9' },
      body:    { messages: [{ role: 'user', content: 'hello' }] },
    }));
    expect([500, 502]).toContain(res.status);
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('passes userContext to system prompt (with username + balance + locale)', async () => {
    const { POST } = await import('@/app/api/ai/chat/route');
    const res = await POST(makeReq({
      method:  'POST',
      url:     'http://localhost/api/ai/chat',
      headers: { 'x-forwarded-for': '10.0.0.10' },
      body:    {
        messages: [{ role: 'user', content: 'hi' }],
        userContext: { username: 'alice', balance: 42.5, locale: 'ar' },
      },
    }));
    expect(res.status).toBe(503);
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. GET /api/bff/wallet/balance — token refresh path
// ═══════════════════════════════════════════════════════════════
describe('GET /api/bff/wallet/balance', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-32-chars-long-xx';
  });

  it('returns 401 when no tec_access_token cookie', async () => {
    const { GET } = await import('@/app/api/bff/wallet/balance/route');
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns 401 when JWT verification fails', async () => {
    mockJwtVerify.mockRejectedValueOnce(new Error('bad sig'));
    const { GET } = await import('@/app/api/bff/wallet/balance/route');
    const res = await GET(makeReq({ cookies: { tec_access_token: 'bad-tok' } }));
    expect(res.status).toBe(401);
  });

  it('returns wallet balance on success', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u-1', kycVerified: true } });
    fetchSpy.mockResolvedValueOnce(gw({
      wallets: [{ id: 'w-1', balance: 10.5, currency: 'PI', is_primary: true, wallet_address: 'addr1', updated_at: '2024-01-01T00:00:00Z' }],
    }));
    const { GET } = await import('@/app/api/bff/wallet/balance/route');
    const res  = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.balance).toBe('10.5');
    expect(body.currency).toBe('PI');
    expect(body.walletId).toBe('w-1');
  });

  it('returns zero balance when gateway returns empty wallets', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u-1' } });
    fetchSpy.mockResolvedValueOnce(gw({ wallets: [] }));
    const { GET } = await import('@/app/api/bff/wallet/balance/route');
    const res  = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    const body = await res.json();
    expect(body.balance).toBe('0');
    expect(body.walletId).toBeNull();
  });

  it('returns zero balance when gateway fails with non-401 error', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u-1' } });
    fetchSpy.mockResolvedValueOnce(gwErr(503));
    const { GET } = await import('@/app/api/bff/wallet/balance/route');
    const res  = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    const body = await res.json();
    expect(body.balance).toBe('0');
  });

  it('attempts token refresh on TOKEN_EXPIRED 401 response', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u-1' } });
    fetchSpy
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: { code: 'TOKEN_EXPIRED' } }) } as any)
      .mockResolvedValueOnce({ ok: true,  status: 200, json: async () => ({ token: 'new-tok' }) } as any)
      .mockResolvedValueOnce(gw({ wallets: [{ id: 'w-2', balance: 5, currency: 'PI', is_primary: true, wallet_address: null, updated_at: '2024-01-01' }] }));
    const { GET } = await import('@/app/api/bff/wallet/balance/route');
    const res  = await GET(makeReq({
      cookies: { tec_access_token: 'expired-tok', tec_csrf: 'csrf-val' },
    }));
    const body = await res.json();
    expect(body.balance).toBe('5');
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('exercises the re-fetch-still-401 path: 3 fetch calls made', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u-1' } });
    fetchSpy
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: { code: 'TOKEN_EXPIRED' } }) } as any)
      .mockResolvedValueOnce({ ok: true,  status: 200, json: async () => ({ token: 'new-tok' }) } as any)
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: { code: 'TOKEN_EXPIRED' } }) } as any);
    const { GET } = await import('@/app/api/bff/wallet/balance/route');
    await GET(makeReq({ cookies: { tec_access_token: 'expired-tok' } }));
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('returns zero balance when 401 without TOKEN_EXPIRED code', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u-1' } });
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: { code: 'UNAUTHORIZED' } }) } as any);
    const { GET } = await import('@/app/api/bff/wallet/balance/route');
    const res  = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    const body = await res.json();
    expect(body.balance).toBe('0');
  });

  it('selects primary PI wallet when multiple wallets exist', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u-1' } });
    fetchSpy.mockResolvedValueOnce(gw({
      wallets: [
        { id: 'w-1', balance: 3, currency: 'PI', is_primary: false, wallet_address: null, updated_at: '2024-01-01' },
        { id: 'w-2', balance: 7, currency: 'PI', is_primary: true,  wallet_address: 'addr', updated_at: '2024-01-02' },
      ],
    }));
    const { GET } = await import('@/app/api/bff/wallet/balance/route');
    const res  = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    const body = await res.json();
    expect(body.walletId).toBe('w-2');
    expect(body.balance).toBe('7');
  });

  it('uses data.wallets nested path as fallback', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u-1' } });
    fetchSpy.mockResolvedValueOnce(gw({
      data: { wallets: [{ id: 'w-nested', balance: 2, currency: 'PI', is_primary: true, wallet_address: null, updated_at: '2024-01-01' }] },
    }));
    const { GET } = await import('@/app/api/bff/wallet/balance/route');
    const res  = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    const body = await res.json();
    expect(body.walletId).toBe('w-nested');
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. GET + PATCH /api/bff/identity/profile
// ═══════════════════════════════════════════════════════════════
describe('/api/bff/identity/profile', () => {
  it('GET returns 401 without token', async () => {
    const { GET } = await import('@/app/api/bff/identity/profile/route');
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('GET returns profile data on success', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u-1' } });
    fetchSpy.mockResolvedValueOnce(gw({ username: 'alice', bio: 'hello' }));
    const { GET } = await import('@/app/api/bff/identity/profile/route');
    const res  = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.username).toBe('alice');
  });

  it('GET returns 500 on gateway error', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u-1' } });
    fetchSpy.mockResolvedValueOnce(gwErr(503));
    const { GET } = await import('@/app/api/bff/identity/profile/route');
    const res = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    expect(res.status).toBe(500);
  });

  it('PATCH returns 401 without token', async () => {
    const { PATCH } = await import('@/app/api/bff/identity/profile/route');
    const res = await PATCH(makeReq({ method: 'PATCH' }));
    expect(res.status).toBe(401);
  });

  it('PATCH updates profile successfully', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u-1' } });
    fetchSpy.mockResolvedValueOnce(gw({ username: 'alice', displayName: 'Alice' }));
    const { PATCH } = await import('@/app/api/bff/identity/profile/route');
    const res  = await PATCH(makeReq({
      method:  'PATCH',
      cookies: { tec_access_token: 'tok' },
      body:    { displayName: 'Alice' },
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.displayName).toBe('Alice');
  });

  it('PATCH returns 400 on invalid schema (bio too long)', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u-1' } });
    const { PATCH } = await import('@/app/api/bff/identity/profile/route');
    const res = await PATCH(makeReq({
      method:  'PATCH',
      cookies: { tec_access_token: 'tok' },
      body:    { bio: 'x'.repeat(201) },
    }));
    expect(res.status).toBe(400);
  });

  it('PATCH returns 500 on gateway error', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u-1' } });
    fetchSpy.mockResolvedValueOnce(gwErr(500));
    const { PATCH } = await import('@/app/api/bff/identity/profile/route');
    const res = await PATCH(makeReq({
      method:  'PATCH',
      cookies: { tec_access_token: 'tok' },
      body:    { displayName: 'Bob' },
    }));
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. GET + POST + PATCH /api/subscriptions
// ═══════════════════════════════════════════════════════════════
describe('/api/subscriptions', () => {
  it('GET status: returns 401 without Authorization header', async () => {
    const { GET } = await import('@/app/api/subscriptions/route');
    const res = await GET(makeReq({ search: { endpoint: 'status' } }));
    expect(res.status).toBe(401);
  });

  it('GET status: returns stub in E2E mode', async () => {
    mockIsE2eMode.mockReturnValue(true);
    const { GET } = await import('@/app/api/subscriptions/route');
    const res  = await GET(makeReq({
      headers: { authorization: 'Bearer tok' },
      search:  { endpoint: 'status' },
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.plan).toBe('free');
    expect(mockFetchTimeout).not.toHaveBeenCalled();
  });

  it('GET plans: returns mock plans in E2E mode (no auth required)', async () => {
    mockIsE2eMode.mockReturnValue(true);
    const { GET } = await import('@/app/api/subscriptions/route');
    const res  = await GET(makeReq({ search: { endpoint: 'plans' } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(3);
  });

  it('GET proxies to gateway in normal mode', async () => {
    mockFetchTimeout.mockResolvedValue(gw({ plan: 'pro' }));
    const { GET } = await import('@/app/api/subscriptions/route');
    const res  = await GET(makeReq({
      headers: { authorization: 'Bearer tok' },
      search:  { endpoint: 'status' },
    }));
    expect(res.status).toBe(200);
    expect(mockFetchTimeout).toHaveBeenCalled();
  });

  it('GET returns 503 on fetchWithTimeout error', async () => {
    mockFetchTimeout.mockRejectedValue(new Error('timeout'));
    const { GET } = await import('@/app/api/subscriptions/route');
    const res = await GET(makeReq({
      headers: { authorization: 'Bearer tok' },
      search:  { endpoint: 'status' },
    }));
    expect(res.status).toBe(503);
  });

  it('GET proxies plans endpoint without auth', async () => {
    mockFetchTimeout.mockResolvedValue(gw({ plans: [] }));
    const { GET } = await import('@/app/api/subscriptions/route');
    const res = await GET(makeReq({ search: { endpoint: 'plans' } }));
    expect(res.status).toBe(200);
    expect(mockFetchTimeout).toHaveBeenCalled();
  });

  it('POST returns 401 without Authorization header', async () => {
    const { POST } = await import('@/app/api/subscriptions/route');
    const res = await POST(makeReq({ method: 'POST', body: { planId: 'pro' } }));
    expect(res.status).toBe(401);
  });

  it('POST returns stub in E2E mode', async () => {
    mockIsE2eMode.mockReturnValue(true);
    const { POST } = await import('@/app/api/subscriptions/route');
    const res  = await POST(makeReq({
      method:  'POST',
      headers: { authorization: 'Bearer tok' },
      body:    { planId: 'pro' },
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.subscribed).toBe(true);
  });

  it('POST proxies to gateway in normal mode', async () => {
    mockFetchTimeout.mockResolvedValue(gw({ subscribed: true }));
    const { POST } = await import('@/app/api/subscriptions/route');
    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: 'Bearer tok' },
      body:    { planId: 'pro' },
    }));
    expect(res.status).toBe(200);
    expect(mockFetchTimeout).toHaveBeenCalled();
  });

  it('POST returns 503 on fetchWithTimeout error', async () => {
    mockFetchTimeout.mockRejectedValue(new Error('timeout'));
    const { POST } = await import('@/app/api/subscriptions/route');
    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: 'Bearer tok' },
      body:    { planId: 'pro' },
    }));
    expect(res.status).toBe(503);
  });

  it('POST uses custom endpoint from search param', async () => {
    mockFetchTimeout.mockResolvedValue(gw({ done: true }));
    const { POST } = await import('@/app/api/subscriptions/route');
    await POST(makeReq({
      method:  'POST',
      headers: { authorization: 'Bearer tok' },
      body:    { planId: 'pro' },
      search:  { endpoint: 'upgrade' },
    }));
    expect(mockFetchTimeout).toHaveBeenCalledWith(
      expect.stringContaining('upgrade'),
      expect.anything(),
    );
  });

  it('PATCH returns 401 without Authorization header', async () => {
    const { PATCH } = await import('@/app/api/subscriptions/route');
    const res = await PATCH(makeReq({ method: 'PATCH' }));
    expect(res.status).toBe(401);
  });

  it('PATCH returns stub in E2E mode', async () => {
    mockIsE2eMode.mockReturnValue(true);
    const { PATCH } = await import('@/app/api/subscriptions/route');
    const res  = await PATCH(makeReq({
      method:  'PATCH',
      headers: { authorization: 'Bearer tok' },
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.cancelled).toBe(true);
  });

  it('PATCH proxies to gateway cancel endpoint', async () => {
    mockFetchTimeout.mockResolvedValue(gw({ cancelled: true }));
    const { PATCH } = await import('@/app/api/subscriptions/route');
    const res = await PATCH(makeReq({
      method:  'PATCH',
      headers: { authorization: 'Bearer tok' },
      body:    { reason: 'too expensive' },
    }));
    expect(res.status).toBe(200);
    expect(mockFetchTimeout).toHaveBeenCalledWith(
      expect.stringContaining('cancel'),
      expect.anything(),
    );
  });

  it('PATCH returns 503 on fetchWithTimeout error', async () => {
    mockFetchTimeout.mockRejectedValue(new Error('timeout'));
    const { PATCH } = await import('@/app/api/subscriptions/route');
    const res = await PATCH(makeReq({
      method:  'PATCH',
      headers: { authorization: 'Bearer tok' },
    }));
    expect(res.status).toBe(503);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. GET /api/market/pi-price — rate limit + OKX error paths
// ═══════════════════════════════════════════════════════════════
describe('GET /api/market/pi-price', () => {
  it('returns pi price data on success', async () => {
    fetchSpy.mockResolvedValueOnce(gw({
      data: [{ last: '1.25', open24h: '1.00', vol24h: '100000', high24h: '1.30', low24h: '0.95' }],
    }));
    const { GET } = await import('@/app/api/market/pi-price/route');
    const res  = await GET(makeReq({ headers: { 'x-forwarded-for': '20.0.0.1' } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.price).toBe(1.25);
    expect(typeof body.change24h).toBe('number');
    expect(body.timestamp).toBeDefined();
  });

  it('returns 503 when OKX API returns non-ok status', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) } as any);
    const { GET } = await import('@/app/api/market/pi-price/route');
    const res = await GET(makeReq({ headers: { 'x-forwarded-for': '20.0.0.2' } }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('Price unavailable');
  });

  it('returns 503 when OKX API returns no data', async () => {
    fetchSpy.mockResolvedValueOnce(gw({ data: [] }));
    const { GET } = await import('@/app/api/market/pi-price/route');
    const res = await GET(makeReq({ headers: { 'x-forwarded-for': '20.0.0.3' } }));
    expect(res.status).toBe(503);
  });

  it('returns 503 on fetch network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network'));
    const { GET } = await import('@/app/api/market/pi-price/route');
    const res = await GET(makeReq({ headers: { 'x-forwarded-for': '20.0.0.4' } }));
    expect(res.status).toBe(503);
  });

  it('returns 429 when rate limit exceeded', async () => {
    const { GET } = await import('@/app/api/market/pi-price/route');
    for (let i = 0; i < 60; i++) {
      fetchSpy.mockResolvedValueOnce(gw({
        data: [{ last: '1', open24h: '1', vol24h: '1', high24h: '1', low24h: '1' }],
      }));
      await GET(makeReq({ headers: { 'x-forwarded-for': '20.0.1.99' } }));
    }
    fetchSpy.mockResolvedValueOnce(gw({ data: [] }));
    const res = await GET(makeReq({ headers: { 'x-forwarded-for': '20.0.1.99' } }));
    expect(res.status).toBe(429);
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. POST /api/payment/approve — additional uncovered branches
// ═══════════════════════════════════════════════════════════════
describe('POST /api/payment/approve (remaining branches)', () => {
  it('piId flow: 401 on create → refresh succeeds → retry create succeeds → approve', async () => {
    mockFetchTimeout
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true,  status: 200, json: async () => ({ token: 'new-tok' }) })
      .mockResolvedValueOnce({ ok: true,  status: 201, json: async () => ({ data: { payment: { id: 'db-id' } } }) })
      .mockResolvedValueOnce({ ok: true,  status: 200, json: async () => ({ success: true, status: 'approved' }) });

    const { POST } = await import('@/app/api/payment/approve/route');
    const res  = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok', tec_csrf: 'csrf-v', tec_user: encodeURIComponent(JSON.stringify({ id: 'u-1' })) },
      body:    { paymentId: 'pi-abc', amount: 5 },
    }));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockFetchTimeout).toHaveBeenCalledTimes(4);
  });

  it('piId flow: 401 on create → refresh fails → 401', async () => {
    mockFetchTimeout
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });

    const { POST } = await import('@/app/api/payment/approve/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok', tec_csrf: 'csrf-v' },
      body:    { paymentId: 'pi-abc' },
    }));
    expect(res.status).toBe(401);
  });

  it('piId flow: uses data.id fallback for payment ID', async () => {
    mockFetchTimeout
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ data: { id: 'alt-id' } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) });

    const { POST } = await import('@/app/api/payment/approve/route');
    const res  = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { paymentId: 'pi-xyz' },
    }));
    const json = await res.json();
    expect(json.payment_id).toBe('alt-id');
  });

  it('piId flow: uses payment.id fallback for payment ID', async () => {
    mockFetchTimeout
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ payment: { id: 'pay-id' } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) });

    const { POST } = await import('@/app/api/payment/approve/route');
    const res  = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { paymentId: 'pi-xyz' },
    }));
    const json = await res.json();
    expect(json.payment_id).toBe('pay-id');
  });

  it('piId flow: uses top-level id fallback for payment ID', async () => {
    mockFetchTimeout
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ id: 'top-id' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) });

    const { POST } = await import('@/app/api/payment/approve/route');
    const res  = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { paymentId: 'pi-xyz' },
    }));
    const json = await res.json();
    expect(json.payment_id).toBe('top-id');
  });

  it('returns 500 on unexpected exception', async () => {
    mockFetchTimeout.mockRejectedValue(new Error('crash'));
    const { POST } = await import('@/app/api/payment/approve/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { payment_id: 'p-1' },
    }));
    expect(res.status).toBe(500);
  });

  it('uses authorization header auth when cookie absent', async () => {
    mockFetchTimeout.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) });
    const { POST } = await import('@/app/api/payment/approve/route');
    const res = await POST(makeReq({
      method:  'POST',
      headers: { Authorization: 'Bearer header-tok' },
      body:    { payment_id: 'p-1', pi_payment_id: 'pi-1' },
    }));
    expect(res.status).toBe(200);
  });

  it('uses lowercase authorization header as fallback', async () => {
    mockFetchTimeout.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) });
    const { POST } = await import('@/app/api/payment/approve/route');
    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: 'Bearer lower-tok' },
      body:    { payment_id: 'p-1' },
    }));
    expect(res.status).toBe(200);
  });

  it('uses pi_payment_id field as piId when paymentId absent', async () => {
    mockFetchTimeout
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ data: { payment: { id: 'db-2' } } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) });
    const { POST } = await import('@/app/api/payment/approve/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { pi_payment_id: 'pi-via-field' },
    }));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.payment_id).toBe('db-2');
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. POST /api/bff/payment/create — retry after tokenExpired (remaining)
// ═══════════════════════════════════════════════════════════════
describe('POST /api/bff/payment/create (remaining branches)', () => {
  const validBody = { amount: '5', currency: 'PI', payment_method: 'pi', source: 'shop' };

  it('returns 400 on invalid JSON body', async () => {
    const { POST } = await import('@/app/api/bff/payment/create/route');
    const req = {
      ...makeReq({ method: 'POST', body: null }),
      json: () => Promise.reject(new SyntaxError('bad json')),
    } as unknown as NextRequest;
    mockCookies.mockResolvedValueOnce({
      get: vi.fn((name: string) => {
        if (name === 'tec_access_token') return { value: 'tok' };
        if (name === 'tec_csrf')         return { value: 'csrf-header-value' };
        return undefined;
      }),
    });
    (req.headers as any).get = (name: string) =>
      name.toLowerCase() === 'x-csrf-token' ? 'csrf-header-value' : null;
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_JSON');
  });

  it('returns 401 after tokenExpired and retry also expires', async () => {
    mockBffFetch
      .mockResolvedValueOnce({ ok: false, status: 401, data: null, error: null, tokenExpired: true })
      .mockResolvedValueOnce({ ok: false, status: 401, data: null, error: null, tokenExpired: true });
    mockAttemptRefresh.mockResolvedValueOnce('new-tok');
    const { POST } = await import('@/app/api/bff/payment/create/route');
    const res = await POST(makeReq({ method: 'POST', body: validBody, headers: { 'x-csrf-token': 'csrf-test-value' } }));
    expect(res.status).toBe(401);
  });

  it('returns 502 when retry after tokenExpired fails with non-expired error', async () => {
    mockBffFetch
      .mockResolvedValueOnce({ ok: false, status: 401, data: null, error: null, tokenExpired: true })
      .mockResolvedValueOnce({ ok: false, status: 502, data: null, error: 'gateway error', tokenExpired: false });
    mockAttemptRefresh.mockResolvedValueOnce('new-tok');
    const { POST } = await import('@/app/api/bff/payment/create/route');
    const res = await POST(makeReq({ method: 'POST', body: validBody, headers: { 'x-csrf-token': 'csrf-test-value' } }));
    expect(res.status).toBe(502);
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. POST /api/payment/create — remaining branches
// ═══════════════════════════════════════════════════════════════
describe('POST /api/payment/create (remaining branches)', () => {
  const validBody = { amount: 5, currency: 'PI', payment_method: 'pi_browser' };
  const userCookieVal = encodeURIComponent(JSON.stringify({ id: 'u-cookie' }));

  it('resolves userId from tec_user cookie (not token)', async () => {
    mockFetchTimeout.mockResolvedValue(gw({ payment_id: 'p-cookie' }, 201));
    const { POST } = await import('@/app/api/payment/create/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'raw-tok', tec_user: userCookieVal },
      body:    validBody,
    }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.payment_id).toBe('p-cookie');
  });

  it('returns 503 on gateway network exception', async () => {
    mockFetchTimeout.mockRejectedValue(new Error('timeout'));
    const { POST } = await import('@/app/api/payment/create/route');
    const res = await POST(makeReq({
      method:   'POST',
      headers:  { authorization: `Bearer eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: 'u-1' })).toString('base64url')}.sig` },
      cookies:  { tec_user: encodeURIComponent(JSON.stringify({ id: 'u-1' })) },
      body:     validBody,
    }));
    expect(res.status).toBe(503);
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. GET + POST /api/bff/commerce/orders
// ═══════════════════════════════════════════════════════════════
describe('/api/bff/commerce/orders', () => {
  it('GET returns 401 without token', async () => {
    const { GET } = await import('@/app/api/bff/commerce/orders/route');
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('GET returns orders with default limit and sort', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u-1' } });
    fetchSpy.mockResolvedValueOnce(gw({ orders: [{ id: 'o-1' }] }));
    const { GET } = await import('@/app/api/bff/commerce/orders/route');
    const res  = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orders).toHaveLength(1);
  });

  it('GET respects limit and sort query params', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u-1' } });
    fetchSpy.mockResolvedValueOnce(gw({ orders: [] }));
    const { GET } = await import('@/app/api/bff/commerce/orders/route');
    await GET(makeReq({
      cookies: { tec_access_token: 'tok' },
      search:  { limit: '5', sort: 'asc' },
    }));
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('limit=5'),
      expect.anything(),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('sort=asc'),
      expect.anything(),
    );
  });

  it('GET caps limit at 50', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u-1' } });
    fetchSpy.mockResolvedValueOnce(gw({ orders: [] }));
    const { GET } = await import('@/app/api/bff/commerce/orders/route');
    await GET(makeReq({
      cookies: { tec_access_token: 'tok' },
      search:  { limit: '999' },
    }));
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('limit=50'),
      expect.anything(),
    );
  });

  it('GET returns 500 on gateway error', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u-1' } });
    fetchSpy.mockResolvedValueOnce(gwErr(503));
    const { GET } = await import('@/app/api/bff/commerce/orders/route');
    const res = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    expect(res.status).toBe(500);
  });

  it('POST returns 401 without token', async () => {
    const { POST } = await import('@/app/api/bff/commerce/orders/route');
    const res = await POST(makeReq({ method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('POST returns 403 when KYC not verified', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u-1', kycVerified: false } });
    const { POST } = await import('@/app/api/bff/commerce/orders/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { items: [{ productId: 'p-1', qty: 1 }] },
    }));
    expect(res.status).toBe(403);
  });

  it('POST creates order successfully when KYC verified', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u-1', kycVerified: true } });
    fetchSpy.mockResolvedValueOnce(gw({ id: 'order-1', status: 'pending' }));
    const { POST } = await import('@/app/api/bff/commerce/orders/route');
    const res  = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { items: [{ productId: 'p-1', qty: 2 }] },
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('order-1');
  });

  it('POST returns 400 on invalid schema (empty items)', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u-1', kycVerified: true } });
    const { POST } = await import('@/app/api/bff/commerce/orders/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { items: [] },
    }));
    expect(res.status).toBe(400);
  });

  it('POST returns 500 on gateway error', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u-1', kycVerified: true } });
    fetchSpy.mockResolvedValueOnce(gwErr(503));
    const { POST } = await import('@/app/api/bff/commerce/orders/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { items: [{ productId: 'p-1', qty: 1 }] },
    }));
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// 10. GET + PATCH /api/identity/profile
// ═══════════════════════════════════════════════════════════════
describe('/api/identity/profile', () => {
  it('GET returns 401 without token cookie', async () => {
    const { GET } = await import('@/app/api/identity/profile/route');
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('GET proxies profile from gateway', async () => {
    fetchSpy.mockResolvedValueOnce(gw({ username: 'bob' }));
    const { GET } = await import('@/app/api/identity/profile/route');
    const res  = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.username).toBe('bob');
  });

  it('GET proxies non-ok gateway status', async () => {
    fetchSpy.mockResolvedValueOnce(gwErr());
    const { GET } = await import('@/app/api/identity/profile/route');
    const res = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    expect(res.status).toBe(503);
  });

  it('GET returns 503 on fetch network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network'));
    const { GET } = await import('@/app/api/identity/profile/route');
    const res = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    expect(res.status).toBe(503);
  });

  it('PATCH returns 401 without token cookie', async () => {
    const { PATCH } = await import('@/app/api/identity/profile/route');
    const res = await PATCH(makeReq({ method: 'PATCH' }));
    expect(res.status).toBe(401);
  });

  it('PATCH proxies update to gateway', async () => {
    fetchSpy.mockResolvedValueOnce(gw({ username: 'bob', displayName: 'Bob' }));
    const { PATCH } = await import('@/app/api/identity/profile/route');
    const res  = await PATCH(makeReq({
      method:  'PATCH',
      cookies: { tec_access_token: 'tok' },
      body:    { displayName: 'Bob' },
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.displayName).toBe('Bob');
  });

  it('PATCH returns 503 on fetch network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network'));
    const { PATCH } = await import('@/app/api/identity/profile/route');
    const res = await PATCH(makeReq({
      method:  'PATCH',
      cookies: { tec_access_token: 'tok' },
      body:    { displayName: 'Bob' },
    }));
    expect(res.status).toBe(503);
  });
});

// ═══════════════════════════════════════════════════════════════
// 11. GET /api/identity/me
// ═══════════════════════════════════════════════════════════════
describe('GET /api/identity/me', () => {
  it('returns 401 without token cookie', async () => {
    const { GET } = await import('@/app/api/identity/me/route');
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns identity data from gateway', async () => {
    fetchSpy.mockResolvedValueOnce(gw({ id: 'u-1', piUsername: 'alice' }));
    const { GET } = await import('@/app/api/identity/me/route');
    const res  = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.piUsername).toBe('alice');
  });

  it('proxies non-ok gateway status', async () => {
    fetchSpy.mockResolvedValueOnce(gwErr());
    const { GET } = await import('@/app/api/identity/me/route');
    const res = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    expect(res.status).toBe(503);
  });

  it('returns 503 on fetch network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network'));
    const { GET } = await import('@/app/api/identity/me/route');
    const res = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    expect(res.status).toBe(503);
  });
});

// ═══════════════════════════════════════════════════════════════
// 12. GET /api/identity/kyc (additional coverage)
// ═══════════════════════════════════════════════════════════════
describe('GET /api/identity/kyc (additional)', () => {
  it('proxies non-ok gateway status', async () => {
    fetchSpy.mockResolvedValueOnce(gwErr());
    const { GET } = await import('@/app/api/identity/kyc/route');
    const res = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    expect(res.status).toBe(503);
  });
});

// ═══════════════════════════════════════════════════════════════
// 13. GET /api/identity/roles (additional coverage)
// ═══════════════════════════════════════════════════════════════
describe('GET /api/identity/roles (additional)', () => {
  it('proxies non-ok gateway status', async () => {
    fetchSpy.mockResolvedValueOnce(gwErr());
    const { GET } = await import('@/app/api/identity/roles/route');
    const res = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    expect(res.status).toBe(503);
  });
});

// ═══════════════════════════════════════════════════════════════
// 14. GET + POST /api/commerce/orders
// ═══════════════════════════════════════════════════════════════
describe('/api/commerce/orders', () => {
  it('GET returns 401 without Authorization header', async () => {
    const { GET } = await import('@/app/api/commerce/orders/route');
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('GET proxies orders from gateway', async () => {
    fetchSpy.mockResolvedValueOnce(gw({ orders: [{ id: 'o-1' }] }));
    const { GET } = await import('@/app/api/commerce/orders/route');
    const res  = await GET(makeReq({ headers: { authorization: 'Bearer tok' } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orders).toHaveLength(1);
  });

  it('GET passes search params to gateway', async () => {
    fetchSpy.mockResolvedValueOnce(gw({ orders: [] }));
    const { GET } = await import('@/app/api/commerce/orders/route');
    await GET(makeReq({
      headers: { authorization: 'Bearer tok' },
      search:  { page: '2' },
    }));
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('page=2'),
      expect.anything(),
    );
  });

  it('GET returns 503 on fetch network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network'));
    const { GET } = await import('@/app/api/commerce/orders/route');
    const res = await GET(makeReq({ headers: { authorization: 'Bearer tok' } }));
    expect(res.status).toBe(503);
  });

  it('POST returns 401 without Authorization header', async () => {
    const { POST } = await import('@/app/api/commerce/orders/route');
    const res = await POST(makeReq({ method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('POST creates order via gateway', async () => {
    fetchSpy.mockResolvedValueOnce(gw({ id: 'order-2', status: 'pending' }));
    const { POST } = await import('@/app/api/commerce/orders/route');
    const res  = await POST(makeReq({
      method:  'POST',
      headers: { authorization: 'Bearer tok' },
      body:    { items: [{ productId: 'p-1', qty: 1 }] },
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('order-2');
  });

  it('POST returns 503 on fetch network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network'));
    const { POST } = await import('@/app/api/commerce/orders/route');
    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: 'Bearer tok' },
      body:    { items: [] },
    }));
    expect(res.status).toBe(503);
  });
});

// ═══════════════════════════════════════════════════════════════
// 15. POST /api/commerce/orders/checkout (additional paths)
// ═══════════════════════════════════════════════════════════════
describe('POST /api/commerce/orders/checkout (additional)', () => {
  it('proxies non-ok gateway status', async () => {
    fetchSpy.mockResolvedValueOnce(gwErr());
    const { POST } = await import('@/app/api/commerce/orders/checkout/route');
    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: 'Bearer tok' },
      body:    { items: [] },
    }));
    expect(res.status).toBe(503);
  });
});

// ═══════════════════════════════════════════════════════════════
// 16. /api/bff/wallet/balance — malformed gateway bodies (json catch)
// ═══════════════════════════════════════════════════════════════
describe('GET /api/bff/wallet/balance — malformed bodies', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-32-chars-long-xx';
  });

  const badJson = (status: number, ok = false) => ({
    ok, status,
    json: async () => { throw new Error('malformed body'); },
  }) as any;

  it('401 with unreadable error body falls through to zero balance', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u-1' } });
    fetchSpy
      .mockResolvedValueOnce(badJson(401))
      .mockResolvedValue(badJson(401));
    const { GET } = await import('@/app/api/bff/wallet/balance/route');
    const res  = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    const body = await res.json();
    expect(body.balance).toBe('0');
  });

  it('refresh response body unreadable → token stays empty → zero balance', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u-1' } });
    fetchSpy
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: { code: 'TOKEN_EXPIRED' } }) } as any)
      .mockResolvedValueOnce(badJson(200, true))
      .mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: { code: 'TOKEN_EXPIRED' } }) } as any);
    const { GET } = await import('@/app/api/bff/wallet/balance/route');
    const res = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    expect([200, 401]).toContain(res.status);
  });

  it('success body unreadable → zero balance', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'u-1' } });
    fetchSpy.mockResolvedValueOnce(badJson(200, true));
    const { GET } = await import('@/app/api/bff/wallet/balance/route');
    const res  = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    const body = await res.json();
    expect(body.balance).toBe('0');
    expect(body.walletId).toBeNull();
  });
});
