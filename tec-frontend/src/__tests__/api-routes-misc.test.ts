/**
 * Tests for miscellaneous API routes not covered elsewhere.
 * auth/logout, auth/pi-login, market/pi-price, notifications,
 * admin/reconcile, subscriptions, identity/*, wallet/balance (legacy)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/server/fetch-with-timeout', () => ({
  fetchWithTimeout: vi.fn(),
}));

vi.mock('@/lib/server/e2e-mode', () => ({
  isE2eMode: vi.fn(() => false),
}));

vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
}));

import { fetchWithTimeout } from '@/lib/server/fetch-with-timeout';
import { isE2eMode }        from '@/lib/server/e2e-mode';
import { jwtVerify }        from 'jose';

const mockFetchWithTimeout = vi.mocked(fetchWithTimeout);
const mockIsE2eMode        = vi.mocked(isE2eMode);
const mockJwtVerify        = vi.mocked(jwtVerify);

const GW = 'https://gw.test';

const makeReq = (opts: {
  method?:      string;
  body?:        unknown;
  token?:       string;
  authHeader?:  string;
  internalKey?: string;
  search?:      string;
  url?:         string;
  forwardedFor?: string;
} = {}) => ({
  cookies: {
    get: (name: string) => {
      if (name === 'tec_access_token' && opts.token) return { value: opts.token };
      if (name === 'tec_user') return { value: JSON.stringify({ id: 'u1' }) };
      return undefined;
    },
  },
  headers: {
    get: (name: string) => {
      if (name === 'authorization')    return opts.authHeader   ?? null;
      if (name === 'x-internal-key')   return opts.internalKey  ?? null;
      if (name === 'x-forwarded-for')  return opts.forwardedFor ?? null;
      return null;
    },
  },
  method:  opts.method ?? 'GET',
  url:     opts.url    ?? 'http://localhost/api/test',
  nextUrl: {
    pathname:     '/api/test',
    searchParams: new URLSearchParams(opts.search ?? ''),
    origin:       'http://localhost:3000',
  },
  json: async () => opts.body ?? {},
} as unknown as any);

const okFetch = (data: unknown = {}) =>
  ({ ok: true,  status: 200, json: async () => data } as Response);
const failFetch = (status = 502) =>
  ({ ok: false, status,      json: async () => ({})  } as Response);

beforeEach(() => {
  process.env.API_GATEWAY_URL     = GW;
  process.env.INTERNAL_SECRET     = 'test-secret-32-chars-long-xxxxx';
  process.env.PAYMENT_SERVICE_URL = 'https://payment.test';
  process.env.SSO_SECRET          = 'sso-secret';
  // resetAllMocks clears queued mockReturnValueOnce stacks; clearAllMocks does not
  vi.resetAllMocks();
  mockIsE2eMode.mockReturnValue(false);
});
afterEach(() => {
  delete process.env.API_GATEWAY_URL;
  delete process.env.INTERNAL_SECRET;
  delete process.env.PAYMENT_SERVICE_URL;
  delete process.env.SSO_SECRET;
});

// ── auth/logout ────────────────────────────────────────────────
describe('POST /api/auth/logout', () => {
  it('returns success and clears all auth cookies', async () => {
    const { POST } = await import('@/app/api/auth/logout/route');
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    const cookies = res.cookies.getAll();
    const names   = cookies.map((c: { name: string }) => c.name);
    expect(names).toContain('tec_access_token');
    expect(names).toContain('tec_csrf');
  });
});

// ── auth/pi-login ──────────────────────────────────────────────
describe('POST /api/auth/pi-login', () => {
  it('returns 400 when accessToken missing', async () => {
    const { POST } = await import('@/app/api/auth/pi-login/route');
    const res = await POST(makeReq({ method: 'POST', body: {} }));
    expect(res.status).toBe(400);
  });

  it('returns 504 when gateway times out', async () => {
    mockFetchWithTimeout.mockRejectedValueOnce(new Error('TIMEOUT'));
    const { POST } = await import('@/app/api/auth/pi-login/route');
    const res = await POST(makeReq({ method: 'POST', body: { accessToken: 'pi-tok' } }));
    expect(res.status).toBe(504);
  });

  it('returns 502 when tokens missing in gateway response', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(okFetch({ success: true, user: {}, tokens: null }));
    const { POST } = await import('@/app/api/auth/pi-login/route');
    const res = await POST(makeReq({ method: 'POST', body: { accessToken: 'pi-tok' } }));
    expect(res.status).toBe(502);
  });

  it('sets auth cookies on successful login', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(okFetch({
      success:   true,
      isNewUser: false,
      user:      { id: 'u1', piUsername: 'alice' },
      tokens:    { accessToken: 'acc-tok', refreshToken: 'ref-tok' },
    }));
    const { POST } = await import('@/app/api/auth/pi-login/route');
    const res = await POST(makeReq({ method: 'POST', body: { accessToken: 'pi-tok' } }));
    expect(res.status).toBe(200);
    const cookies = res.cookies.getAll();
    const names   = cookies.map((c: { name: string }) => c.name);
    expect(names).toContain('tec_access_token');
    expect(names).toContain('tec_user');
    expect(names).toContain('tec_csrf');
  });
});

// ── auth/sso-callback ──────────────────────────────────────────
describe('GET /api/auth/sso-callback', () => {
  it('redirects to /hub when token param missing', async () => {
    const { GET } = await import('@/app/api/auth/sso-callback/route');
    const res = await GET(makeReq({ url: 'http://localhost/api/auth/sso-callback' }));
    expect(res.status).toBe(307);
  });

  it('returns 503 when SSO_SECRET not configured', async () => {
    delete process.env.SSO_SECRET;
    const { GET } = await import('@/app/api/auth/sso-callback/route');
    const req = makeReq({
      url:    'http://localhost/api/auth/sso-callback?token=abc',
      search: 'token=abc',
    });
    const res = await GET(req);
    expect([503, 307]).toContain(res.status);
  });

  it('redirects to / when JWT verify fails', async () => {
    mockJwtVerify.mockRejectedValue(new Error('invalid'));
    const { GET } = await import('@/app/api/auth/sso-callback/route');
    const req = makeReq({
      url:    'http://localhost/api/auth/sso-callback?token=bad-tok',
      search: 'token=bad-tok',
    });
    const res = await GET(req);
    expect(res.status).toBe(307);
  });
});

// ── market/pi-price ────────────────────────────────────────────
describe('GET /api/market/pi-price', () => {
  it('returns price data from OKX', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok:   true,
      json: async () => ({
        data: [{ last: '1.23', open24h: '1.00', vol24h: '1000', high24h: '1.30', low24h: '0.95' }],
      }),
    } as Response);
    const { GET } = await import('@/app/api/market/pi-price/route');
    const res  = await GET(makeReq({ forwardedFor: '127.0.0.1' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.price).toBeCloseTo(1.23);
  });

  it('returns 503 when OKX call fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('OKX down'));
    const { GET } = await import('@/app/api/market/pi-price/route');
    const res = await GET(makeReq({ forwardedFor: '127.0.0.1' }));
    expect(res.status).toBe(503);
  });

  it('returns 503 when OKX returns no data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, json: async () => ({ data: [] }),
    } as Response);
    const { GET } = await import('@/app/api/market/pi-price/route');
    const res = await GET(makeReq({ forwardedFor: '10.0.0.1' }));
    expect(res.status).toBe(503);
  });
});

// ── notifications (legacy) ─────────────────────────────────────
describe('GET /api/notifications', () => {
  it('returns 401 when token missing', async () => {
    const { GET } = await import('@/app/api/notifications/route');
    const res = await GET(makeReq({ url: 'http://localhost/api/notifications' }));
    expect(res.status).toBe(401);
  });

  it('returns notification data when authenticated', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ notifications: [], unread: 0 }),
    } as Response);
    const { GET } = await import('@/app/api/notifications/route');
    const res = await GET(makeReq({ token: 'my-tok', url: 'http://localhost/api/notifications' }));
    expect(res.status).toBe(200);
  });
});

// ── admin/reconcile ───────────────────────────────────────────
describe('POST|GET /api/admin/reconcile', () => {
  it('returns 401 when neither internal key nor bearer provided', async () => {
    const { POST } = await import('@/app/api/admin/reconcile/route');
    const res = await POST(makeReq({ method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('calls payment service with bearer token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(okFetch({ reconciled: 3 }));
    const { POST } = await import('@/app/api/admin/reconcile/route');
    const res = await POST(makeReq({ method: 'POST', authHeader: 'Bearer admin-tok' }));
    expect(res.status).toBe(200);
  });

  it('returns 503 when payment service unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Connection refused'));
    const { POST } = await import('@/app/api/admin/reconcile/route');
    const res = await POST(makeReq({ method: 'POST', authHeader: 'Bearer admin-tok' }));
    expect(res.status).toBe(503);
  });

  it('GET delegates to POST', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(okFetch({ reconciled: 0 }));
    const { GET } = await import('@/app/api/admin/reconcile/route');
    const res = await GET(makeReq({ authHeader: 'Bearer admin-tok' }));
    expect(res.status).toBe(200);
  });
});

// ── subscriptions ──────────────────────────────────────────────
describe('/api/subscriptions', () => {
  it('GET status returns 401 without auth header', async () => {
    const { GET } = await import('@/app/api/subscriptions/route');
    const res = await GET(makeReq({ search: 'endpoint=status' }));
    expect(res.status).toBe(401);
  });

  it('GET plans returns mock data in e2e mode', async () => {
    mockIsE2eMode.mockReturnValueOnce(true);
    mockIsE2eMode.mockReturnValueOnce(true);
    const { GET } = await import('@/app/api/subscriptions/route');
    const res  = await GET(makeReq({ search: 'endpoint=plans' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toBeDefined();
  });

  it('GET status calls gateway when auth present', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(okFetch({ plan: 'free', status: 'active' }));
    const { GET } = await import('@/app/api/subscriptions/route');
    const res = await GET(makeReq({ authHeader: 'Bearer tok', search: 'endpoint=status' }));
    expect(res.status).toBe(200);
  });

  it('POST returns 401 without auth header', async () => {
    const { POST } = await import('@/app/api/subscriptions/route');
    const res = await POST(makeReq({ method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('POST subscribes via gateway', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(okFetch({ subscribed: true }));
    const { POST } = await import('@/app/api/subscriptions/route');
    const res = await POST(makeReq({ method: 'POST', authHeader: 'Bearer tok', body: { planId: 'pro' } }));
    expect(res.status).toBe(200);
  });

  it('PATCH returns 401 without auth header', async () => {
    const { PATCH } = await import('@/app/api/subscriptions/route');
    const res = await PATCH(makeReq({ method: 'PATCH' }));
    expect(res.status).toBe(401);
  });

  it('PATCH cancels subscription via gateway', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(okFetch({ cancelled: true }));
    const { PATCH } = await import('@/app/api/subscriptions/route');
    const res = await PATCH(makeReq({ method: 'PATCH', authHeader: 'Bearer tok', body: {} }));
    expect(res.status).toBe(200);
  });
});

// ── identity/profile ──────────────────────────────────────────
describe('/api/identity/profile', () => {
  it('GET returns 401 without cookie', async () => {
    const { GET } = await import('@/app/api/identity/profile/route');
    const req = { ...makeReq(), cookies: { get: () => undefined } } as any;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('GET returns profile from gateway', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ id: 'u1', username: 'alice' }),
    } as Response);
    const { GET } = await import('@/app/api/identity/profile/route');
    const res  = await GET(makeReq({ token: 'tok' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.username).toBe('alice');
  });

  it('PATCH returns 401 without cookie', async () => {
    const { PATCH } = await import('@/app/api/identity/profile/route');
    const req = { ...makeReq({ method: 'PATCH' }), cookies: { get: () => undefined } } as any;
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it('PATCH updates profile via gateway', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ id: 'u1', displayName: 'Alice Updated' }),
    } as Response);
    const { PATCH } = await import('@/app/api/identity/profile/route');
    const res = await PATCH(makeReq({ method: 'PATCH', token: 'tok', body: { displayName: 'Alice Updated' } }));
    expect(res.status).toBe(200);
  });
});

// ── identity/me ───────────────────────────────────────────────
describe('GET /api/identity/me', () => {
  it('returns 401 without cookie', async () => {
    const { GET } = await import('@/app/api/identity/me/route');
    const req = { ...makeReq(), cookies: { get: () => undefined } } as any;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns identity from gateway', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ id: 'u1', piUsername: 'alice' }),
    } as Response);
    const { GET } = await import('@/app/api/identity/me/route');
    const res  = await GET(makeReq({ token: 'tok' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.piUsername).toBe('alice');
  });

  it('returns 503 when gateway throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));
    const { GET } = await import('@/app/api/identity/me/route');
    const res = await GET(makeReq({ token: 'tok' }));
    expect(res.status).toBe(503);
  });
});

// ── wallet/balance (legacy) ───────────────────────────────────
describe('GET /api/wallet/balance (legacy)', () => {
  it('returns 401 without authorization header', async () => {
    const { GET } = await import('@/app/api/wallet/balance/route');
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns zero balance in e2e mode', async () => {
    mockIsE2eMode.mockReturnValueOnce(true);
    const { GET } = await import('@/app/api/wallet/balance/route');
    const res  = await GET(makeReq({ authHeader: 'Bearer tok' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.balance).toBe(0);
  });

  it('returns 400 when userId cannot be resolved', async () => {
    const { GET } = await import('@/app/api/wallet/balance/route');
    const req = {
      ...makeReq({ authHeader: 'Bearer tok' }),
      cookies: { get: () => undefined },
      nextUrl: { searchParams: new URLSearchParams('') },
    } as any;
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns balance from gateway', async () => {
    const wallet = {
      id: 'w1', balance: 9.5, currency: 'PI',
      is_primary: true, wallet_address: null, updated_at: new Date().toISOString(),
    };
    mockFetchWithTimeout.mockResolvedValueOnce(okFetch({ wallets: [wallet] }));
    const { GET } = await import('@/app/api/wallet/balance/route');
    const res  = await GET(makeReq({ authHeader: 'Bearer tok' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.balance).toBe(9.5);
    expect(body.walletId).toBe('w1');
  });

  it('returns fallback zero on gateway failure', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(failFetch(503));
    const { GET } = await import('@/app/api/wallet/balance/route');
    const res  = await GET(makeReq({ authHeader: 'Bearer tok' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.balance).toBe(0);
  });
});
