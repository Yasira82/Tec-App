/**
 * Final coverage batch — covers remaining 0% API routes:
 *   assets/provision, assets/marketplace, bff/assets/mint-as-nft,
 *   bff/payment/create, commerce/orders/checkout, identity/kyc,
 *   identity/roles, marketplace, marketplace/[id]/buy,
 *   notifications/[id]/read, notifications/read-all,
 *   auth/sso-callback, middleware
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// ── Hoisted mocks ─────────────────────────────────────────────
const mockJwtVerify = vi.hoisted(() => vi.fn());

vi.mock('jose', () => ({
  jwtVerify: mockJwtVerify,
}));

const mockCookies = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

// ── Helpers ───────────────────────────────────────────────────
type ReqOpts = {
  method?:     string;
  token?:      string;
  body?:       unknown;
  search?:     string;
  url?:        string;
  authHeader?: string;
  csrfHeader?: string;
};

function makeReq(opts: ReqOpts = {}): NextRequest {
  const url = opts.url ?? `http://localhost/api/test${opts.search ? `?${opts.search}` : ''}`;
  return {
    cookies: {
      get: (name: string) => {
        if (name === 'tec_access_token' && opts.token) return { value: opts.token };
        return undefined;
      },
    },
    headers: {
      get: (name: string) => {
        if (name === 'authorization' && opts.authHeader) return opts.authHeader;
        if (name === 'x-csrf-token' && opts.csrfHeader)  return opts.csrfHeader;
        return null;
      },
    },
    method:  opts.method ?? 'GET',
    url,
    nextUrl: {
      pathname:     new URL(url).pathname,
      searchParams: new URLSearchParams(opts.search ?? ''),
      origin:       'http://localhost',
    },
    json: async () => opts.body ?? {},
  } as unknown as NextRequest;
}

function makeJwt(payload: Record<string, unknown>): string {
  const header  = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body    = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

const gw    = (data: unknown = {}, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: async () => data }) as any;
const gwErr = (status = 503) =>
  Promise.resolve({ ok: false, status, json: async () => ({ error: 'err' }) }) as any;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.API_GATEWAY_URL  = 'https://gw.test';
  process.env.JWT_SECRET       = 'test-jwt-secret-32-chars-long-xx';
  process.env.SSO_SECRET       = 'sso-secret-test-32-chars-for-vitest';
  process.env.INTERNAL_SECRET  = 'internal-secret-key';

  // Default next/headers cookies for payment/create tests
  mockCookies.mockResolvedValue({
    get: vi.fn((name: string) => {
      if (name === 'tec_access_token') return { value: 'test-access-token' };
      if (name === 'tec_csrf')         return { value: 'csrf-test-value' };
      return undefined;
    }),
  });
});

// ═══════════════════════════════════════════════════════════════
// middleware.ts
// ═══════════════════════════════════════════════════════════════
describe('middleware', () => {
  function makeMiddlewareReq(opts: {
    pathname:   string;
    method?:    string;
    token?:     string;
    csrfCookie?: string;
    csrfHeader?: string;
  }) {
    const url = `http://localhost${opts.pathname}`;
    return {
      cookies: {
        get: (n: string) => {
          if (n === 'tec_access_token' && opts.token) return { value: opts.token };
          if (n === 'tec_csrf' && opts.csrfCookie)   return { value: opts.csrfCookie };
          return undefined;
        },
      },
      headers: {
        get: (n: string) => {
          if (n === 'x-csrf-token') return opts.csrfHeader ?? null;
          return null;
        },
      },
      method:  opts.method ?? 'GET',
      url,
      nextUrl: { pathname: opts.pathname },
    } as unknown as NextRequest;
  }

  it('redirects unauthenticated access to protected route', async () => {
    const { middleware } = await import('@/middleware');
    const req = makeMiddlewareReq({ pathname: '/dashboard' });
    const res = middleware(req);
    expect(res.status).toBe(307);
  });

  it('renders /hub WITHOUT a cookie — client-guarded, cookie-independent entry (C-123 §7)', async () => {
    const { middleware } = await import('@/middleware');
    const req = makeMiddlewareReq({ pathname: '/hub' });
    const res = middleware(req);
    // The hub shell must always render so the client can resolve the session
    // in memory (silent Pi re-auth). A cookie check here caused "hub won't open".
    expect(res.status).toBe(200);
  });

  it('allows authenticated access to protected route', async () => {
    const { middleware } = await import('@/middleware');
    const req = makeMiddlewareReq({ pathname: '/dashboard', token: 'my-token' });
    const res = middleware(req);
    expect(res.status).toBe(200);
  });

  it('allows GET on public route without CSRF', async () => {
    const { middleware } = await import('@/middleware');
    const req = makeMiddlewareReq({ pathname: '/api/auth/logout', method: 'GET' });
    const res = middleware(req);
    expect(res.status).toBe(200);
  });

  it('blocks POST to CSRF-protected route without CSRF token', async () => {
    const { middleware } = await import('@/middleware');
    const req = makeMiddlewareReq({ pathname: '/api/kyc/start', method: 'POST' });
    const res = middleware(req);
    expect(res.status).toBe(403);
  });

  it('allows POST with matching CSRF token', async () => {
    const { middleware } = await import('@/middleware');
    const req = makeMiddlewareReq({
      pathname:    '/api/kyc/start',
      method:      'POST',
      csrfCookie:  'csrf-abc',
      csrfHeader:  'csrf-abc',
    });
    const res = middleware(req);
    expect(res.status).toBe(200);
  });

  it('allows GET to non-protected route without token', async () => {
    const { middleware } = await import('@/middleware');
    const req = makeMiddlewareReq({ pathname: '/about' });
    const res = middleware(req);
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/assets/provision
// ═══════════════════════════════════════════════════════════════
describe('POST /api/assets/provision', () => {
  it('returns 401 without token', async () => {
    const { POST } = await import('@/app/api/assets/provision/route');
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns 401 when jwtVerify fails', async () => {
    mockJwtVerify.mockRejectedValueOnce(new Error('bad token'));
    const { POST } = await import('@/app/api/assets/provision/route');
    const res = await POST(makeReq({ token: 'bad-tok' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when slug missing', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'user-123' } });
    const { POST } = await import('@/app/api/assets/provision/route');
    const res = await POST(makeReq({ token: 'tok', body: { payment_id: 'pay-1' } }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('slug');
  });

  it('returns 400 when slug too short after sanitization', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'user-123' } });
    const { POST } = await import('@/app/api/assets/provision/route');
    const res = await POST(makeReq({ token: 'tok', body: { slug: 'ab', payment_id: 'pay-1' } }));
    expect(res.status).toBe(400);
  });

  it('provisions DOMAIN asset with .pi extension', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'user-123' } });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(gw({ data: { id: 'a1', slug: 'myname' } }));
    const { POST } = await import('@/app/api/assets/provision/route');
    const res  = await POST(makeReq({ token: 'tok', body: { slug: 'myname', payment_id: 'pay-1', category: 'DOMAIN' } }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.id).toBe('a1');
  });

  it('proxies gateway error status', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: { sub: 'user-123' } });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(gwErr(409));
    const { POST } = await import('@/app/api/assets/provision/route');
    const res = await POST(makeReq({ token: 'tok', body: { slug: 'myslug', payment_id: 'pay-1' } }));
    expect(res.status).toBe(409);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/assets/marketplace
// ═══════════════════════════════════════════════════════════════
describe('GET /api/assets/marketplace', () => {
  it('returns marketplace data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(gw({ items: [{ id: 'm1' }] }));
    const { GET } = await import('@/app/api/assets/marketplace/route');
    const res  = await GET(makeReq({ search: 'limit=5' }));
    const body = await res.json();
    expect(body.items).toHaveLength(1);
  });

  it('returns 500 on gateway throw', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));
    const { GET } = await import('@/app/api/assets/marketplace/route');
    const res = await GET(makeReq());
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/bff/assets/mint-as-nft
// ═══════════════════════════════════════════════════════════════
describe('POST /api/bff/assets/mint-as-nft', () => {
  it('returns 401 without token', async () => {
    const { POST } = await import('@/app/api/bff/assets/mint-as-nft/route');
    const res = await POST(makeReq({ method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when assetId missing', async () => {
    const token = makeJwt({ sub: 'user-123' });
    const { POST } = await import('@/app/api/bff/assets/mint-as-nft/route');
    const res = await POST(makeReq({ method: 'POST', token, body: { transactionId: 'tx-1' } }));
    expect(res.status).toBe(400);
  });

  it('mints NFT and returns gateway response', async () => {
    const token = makeJwt({ sub: 'user-123' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(gw({ success: true, assetId: 'a1' }));
    const { POST } = await import('@/app/api/bff/assets/mint-as-nft/route');
    const res  = await POST(makeReq({ method: 'POST', token, body: { assetId: 'a1', transactionId: 'tx-1' } }));
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 500 on exception', async () => {
    const token = makeJwt({ sub: 'user-123' });
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('fail'));
    const { POST } = await import('@/app/api/bff/assets/mint-as-nft/route');
    const res = await POST(makeReq({ method: 'POST', token, body: { assetId: 'a1', transactionId: 'tx-1' } }));
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/bff/payment/create
// ═══════════════════════════════════════════════════════════════
describe('POST /api/bff/payment/create', () => {
  const validBody = {
    amount:         '5',
    currency:       'PI',
    payment_method: 'pi',
    source:         'shop',
  };

  it('returns 401 without access token', async () => {
    mockCookies.mockResolvedValueOnce({
      get: vi.fn(() => undefined),
    });
    const { POST } = await import('@/app/api/bff/payment/create/route');
    const res = await POST(makeReq({ method: 'POST', body: validBody, csrfHeader: 'csrf-tok' }));
    expect(res.status).toBe(401);
  });

  it('does NOT 403 on CSRF mismatch — CSRF is delegated to middleware', async () => {
    // CSRF is enforced once in middleware (double-submit OR first-party Origin).
    // The route no longer double-checks it (that risked 403'ing Pi-Browser payments).
    mockCookies.mockResolvedValueOnce({
      get: vi.fn((name: string) => {
        if (name === 'tec_access_token') return { value: 'test-tok' };
        if (name === 'tec_csrf')         return { value: 'csrf-correct' };
        return undefined;
      }),
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      gw({ success: true, data: { payment: { id: 'p1', status: 'created', amount: '5', currency: 'PI', user_id: 'u1' } } }, 201),
    );
    const { POST } = await import('@/app/api/bff/payment/create/route');
    const res = await POST(makeReq({ method: 'POST', body: validBody, csrfHeader: 'csrf-wrong' }));
    expect(res.status).not.toBe(403);   // mismatch no longer blocks at the route
    fetchSpy.mockRestore();
  });

  it('returns 400 on invalid request body', async () => {
    const { POST } = await import('@/app/api/bff/payment/create/route');
    const res = await POST(makeReq({ method: 'POST', body: { amount: -1 }, csrfHeader: 'csrf-test-value' }));
    expect(res.status).toBe(400);
  });

  it('forwards to canonical gateway path with number amount + x-internal-key, returns 201', async () => {
    const paymentData = { success: true, data: { payment: { id: 'p1', status: 'created', amount: '5', currency: 'PI', user_id: 'u1' } } };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(gw(paymentData, 201));
    const { POST } = await import('@/app/api/bff/payment/create/route');
    const res = await POST(makeReq({ method: 'POST', body: validBody, csrfHeader: 'csrf-test-value' }));
    expect(res.status).toBe(201);

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://gw.test/api/payment/create');
    expect((init.headers as Record<string, string>)['x-internal-key']).toBe('internal-secret-key');
    const sent = JSON.parse(init.body as string);
    expect(sent.amount).toBe(5);
    expect(typeof sent.amount).toBe('number');
  });

  it('returns 502 when the gateway is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network'));
    const { POST } = await import('@/app/api/bff/payment/create/route');
    const res = await POST(makeReq({ method: 'POST', body: validBody, csrfHeader: 'csrf-test-value' }));
    expect(res.status).toBe(502);
  });

  it('propagates the gateway status on error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(gwErr(409));
    const { POST } = await import('@/app/api/bff/payment/create/route');
    const res = await POST(makeReq({ method: 'POST', body: validBody, csrfHeader: 'csrf-test-value' }));
    expect(res.status).toBe(409);
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/commerce/orders/checkout
// ═══════════════════════════════════════════════════════════════
describe('POST /api/commerce/orders/checkout', () => {
  it('returns 401 without authorization header', async () => {
    const { POST } = await import('@/app/api/commerce/orders/checkout/route');
    const res = await POST(makeReq({ method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('returns checkout data from gateway', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(gw({ orderId: 'o1' }));
    const { POST } = await import('@/app/api/commerce/orders/checkout/route');
    const res  = await POST(makeReq({ method: 'POST', authHeader: 'Bearer tok', body: { items: [] } }));
    const body = await res.json();
    expect(body.orderId).toBe('o1');
  });

  it('returns 503 on gateway throw', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network'));
    const { POST } = await import('@/app/api/commerce/orders/checkout/route');
    const res = await POST(makeReq({ method: 'POST', authHeader: 'Bearer tok', body: {} }));
    expect(res.status).toBe(503);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/identity/kyc
// ═══════════════════════════════════════════════════════════════
describe('GET /api/identity/kyc', () => {
  it('returns 401 without token', async () => {
    const { GET } = await import('@/app/api/identity/kyc/route');
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns KYC data from gateway', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(gw({ status: 'VERIFIED' }));
    const { GET } = await import('@/app/api/identity/kyc/route');
    const res  = await GET(makeReq({ token: 'tok' }));
    const body = await res.json();
    expect(body.status).toBe('VERIFIED');
  });

  it('returns 503 on gateway throw', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network'));
    const { GET } = await import('@/app/api/identity/kyc/route');
    const res = await GET(makeReq({ token: 'tok' }));
    expect(res.status).toBe(503);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/identity/roles
// ═══════════════════════════════════════════════════════════════
describe('GET /api/identity/roles', () => {
  it('returns 401 without token', async () => {
    const { GET } = await import('@/app/api/identity/roles/route');
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns roles from gateway', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(gw({ roles: ['user', 'admin'] }));
    const { GET } = await import('@/app/api/identity/roles/route');
    const res  = await GET(makeReq({ token: 'tok' }));
    const body = await res.json();
    expect(body.roles).toContain('admin');
  });

  it('returns 503 on gateway throw', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network'));
    const { GET } = await import('@/app/api/identity/roles/route');
    const res = await GET(makeReq({ token: 'tok' }));
    expect(res.status).toBe(503);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET + POST /api/marketplace
// ═══════════════════════════════════════════════════════════════
describe('GET /api/marketplace', () => {
  it('returns marketplace listing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(gw({ items: [] }));
    const { GET } = await import('@/app/api/marketplace/route');
    const res  = await GET(makeReq({ search: 'page=1' }));
    const body = await res.json();
    expect(body.items).toHaveLength(0);
  });

  it('returns 503 on gateway throw', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network'));
    const { GET } = await import('@/app/api/marketplace/route');
    const res = await GET(makeReq());
    expect(res.status).toBe(503);
  });
});

describe('POST /api/marketplace', () => {
  it('returns result from marketplace endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(gw({ listed: true }));
    const { POST } = await import('@/app/api/marketplace/route');
    const res  = await POST(makeReq({ method: 'POST', body: { assetId: 'a1' }, search: 'action=list' }));
    const body = await res.json();
    expect(body.listed).toBe(true);
  });

  it('returns 503 on gateway throw', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network'));
    const { POST } = await import('@/app/api/marketplace/route');
    const res = await POST(makeReq({ method: 'POST', body: {} }));
    expect(res.status).toBe(503);
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/marketplace/[id]/buy
// ═══════════════════════════════════════════════════════════════
describe('POST /api/marketplace/[id]/buy', () => {
  it('returns 401 without token', async () => {
    const { POST } = await import('@/app/api/marketplace/[id]/buy/route');
    const res = await POST(makeReq({ method: 'POST' }), { params: Promise.resolve({ id: 'asset-1' }) });
    expect(res.status).toBe(401);
  });

  it('completes buy and returns gateway response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(gw({ success: true }));
    const { POST } = await import('@/app/api/marketplace/[id]/buy/route');
    const res  = await POST(makeReq({ method: 'POST', token: 'tok', body: { paymentId: 'p1' } }), { params: Promise.resolve({ id: 'asset-1' }) });
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 503 on gateway throw', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('fail'));
    const { POST } = await import('@/app/api/marketplace/[id]/buy/route');
    const res = await POST(makeReq({ method: 'POST', token: 'tok', body: {} }), { params: Promise.resolve({ id: 'asset-1' }) });
    expect(res.status).toBe(503);
  });
});

// ═══════════════════════════════════════════════════════════════
// PATCH /api/notifications/[id]/read
// ═══════════════════════════════════════════════════════════════
describe('PATCH /api/notifications/[id]/read', () => {
  it('returns 401 without token', async () => {
    const { PATCH } = await import('@/app/api/notifications/[id]/read/route');
    const res = await PATCH(makeReq({ method: 'PATCH' }), { params: Promise.resolve({ id: 'n1' }) });
    expect(res.status).toBe(401);
  });

  it('marks notification as read', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(gw({ success: true }));
    const { PATCH } = await import('@/app/api/notifications/[id]/read/route');
    const res  = await PATCH(makeReq({ method: 'PATCH', token: 'tok' }), { params: Promise.resolve({ id: 'n1' }) });
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 500 on gateway throw', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('fail'));
    const { PATCH } = await import('@/app/api/notifications/[id]/read/route');
    const res = await PATCH(makeReq({ method: 'PATCH', token: 'tok' }), { params: Promise.resolve({ id: 'n1' }) });
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// PATCH /api/notifications/read-all
// ═══════════════════════════════════════════════════════════════
describe('PATCH /api/notifications/read-all', () => {
  it('returns 401 without token', async () => {
    const { PATCH } = await import('@/app/api/notifications/read-all/route');
    const res = await PATCH(makeReq({ method: 'PATCH' }));
    expect(res.status).toBe(401);
  });

  it('marks all notifications as read', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(gw({ updated: 5 }));
    const { PATCH } = await import('@/app/api/notifications/read-all/route');
    const res  = await PATCH(makeReq({ method: 'PATCH', token: 'tok' }));
    const body = await res.json();
    expect(body.updated).toBe(5);
  });

  it('returns 500 on gateway throw', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('fail'));
    const { PATCH } = await import('@/app/api/notifications/read-all/route');
    const res = await PATCH(makeReq({ method: 'PATCH', token: 'tok' }));
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/auth/sso-callback
// ═══════════════════════════════════════════════════════════════
describe('GET /api/auth/sso-callback', () => {
  function makeCallbackReq(opts: { token?: string; redirect?: string; url?: string } = {}) {
    const params = new URLSearchParams();
    if (opts.token)    params.set('token',    opts.token);
    if (opts.redirect) params.set('redirect', opts.redirect);
    const url = `http://localhost/api/auth/sso-callback?${params.toString()}`;
    return {
      cookies:  { get: () => undefined },
      headers:  { get: () => null },
      method:   'GET',
      url:      opts.url ?? url,
      nextUrl:  {
        pathname:     '/api/auth/sso-callback',
        searchParams: params,
        origin:       'http://localhost',
      },
      json: async () => ({}),
    } as unknown as NextRequest;
  }

  it('redirects to /hub when no token', async () => {
    const { GET } = await import('@/app/api/auth/sso-callback/route');
    const res = await GET(makeCallbackReq());
    expect(res.status).toBe(307);
  });

  it('returns 503 when SSO_SECRET not set', async () => {
    delete process.env.SSO_SECRET;
    const { GET } = await import('@/app/api/auth/sso-callback/route');
    const res = await GET(makeCallbackReq({ token: 'tok' }));
    expect(res.status).toBe(503);
    process.env.SSO_SECRET = 'sso-secret-test-32-chars-for-vitest';
  });

  it('redirects to / when jwtVerify fails for all audiences', async () => {
    mockJwtVerify.mockRejectedValue(new Error('bad sig'));
    const { GET } = await import('@/app/api/auth/sso-callback/route');
    const res = await GET(makeCallbackReq({ token: 'invalid-token' }));
    expect(res.status).toBe(307);
    mockJwtVerify.mockReset();
  });

  it('sets cookies and returns the 200 HTML landing page on valid SSO token', async () => {
    const jti = `jti-fresh-${Date.now()}-${Math.random()}`;
    mockJwtVerify
      .mockRejectedValueOnce(new Error('wrong audience'))
      .mockResolvedValueOnce({
        payload: {
          jti,
          accessToken: 'access-tok-xyz',
          user: { id: 'u1', piUsername: 'alice' },
        },
      });
    const { GET } = await import('@/app/api/auth/sso-callback/route');
    const res = await GET(makeCallbackReq({ token: 'valid-sso-tok', redirect: '/hub' }));
    // 200 HTML landing (NOT a 3xx): Pi Browser drops Set-Cookie on redirect
    // responses, so the callback sets cookies on a plain HTML response and its
    // script verifies the session via /api/auth/me before entering the app.
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const cookieHeader = res.headers.get('set-cookie') ?? '';
    expect(cookieHeader).toContain('tec_access_token');
    const body = await res.text();
    expect(body).toContain('/api/auth/me');
    expect(body).toContain('"/hub"');
  });

  it('returns 401 when JTI is replayed', async () => {
    const replayJti = `replay-jti-${Date.now()}`;
    const payload = {
      jti:         replayJti,
      accessToken: 'tok',
      user:        { id: 'u2', piUsername: 'bob' },
    };
    // First call — succeeds and marks JTI used
    mockJwtVerify.mockResolvedValue({ payload });
    const { GET } = await import('@/app/api/auth/sso-callback/route');
    await GET(makeCallbackReq({ token: 'sso-tok' }));
    // Second call — JTI already used
    const res = await GET(makeCallbackReq({ token: 'sso-tok' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('replay_detected');
    mockJwtVerify.mockReset();
  });
});

// ═══════════════════════════════════════════════════════════════
// lib-client/api/health — checkGatewayHealth
// ═══════════════════════════════════════════════════════════════
describe('checkGatewayHealth', () => {
  it('returns online=true when gateway responds ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, json: async () => ({ services: { auth: 'up' } }),
    } as any);
    const { checkGatewayHealth } = await import('@/lib-client/api/health');
    const result = await checkGatewayHealth();
    expect(result.online).toBe(true);
    expect(result.services).toEqual({ auth: 'up' });
  });

  it('returns online=false when gateway returns non-ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false } as any);
    const { checkGatewayHealth } = await import('@/lib-client/api/health');
    const result = await checkGatewayHealth();
    expect(result.online).toBe(false);
  });

  it('returns online=false when fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const { checkGatewayHealth } = await import('@/lib-client/api/health');
    const result = await checkGatewayHealth();
    expect(result.online).toBe(false);
  });
});
