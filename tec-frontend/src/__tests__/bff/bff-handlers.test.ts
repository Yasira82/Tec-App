/**
 * BFF route handler tests — covers createHandler-based routes.
 * Each describe block imports the route fresh after setting env vars.
 */
import {
  describe, it, expect, vi,
  beforeAll, beforeEach, afterAll,
} from 'vitest';
import type { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────
vi.mock('jose', () => ({ jwtVerify: vi.fn() }));
import { jwtVerify } from 'jose';
const mockJwt = vi.mocked(jwtVerify);

const GATEWAY = 'https://gw.test.example.com';

const makeReq = (opts: {
  token?:    string;
  body?:     unknown;
  method?:   string;
  search?:   string;
  origin?:   string;
  csrfCookie?: string;
} = {}): NextRequest => ({
  cookies: {
    get: (n: string) => {
      if (n === 'tec_access_token' && opts.token)  return { value: opts.token };
      if (n === 'tec_csrf' && opts.csrfCookie)       return { value: opts.csrfCookie };
      return undefined;
    },
  },
  headers: { get: () => opts.origin ?? null },
  method:  opts.method ?? 'GET',
  nextUrl: {
    pathname:     '/api/test',
    searchParams: new URLSearchParams(opts.search ?? ''),
    origin:       opts.origin ?? 'http://localhost:3000',
  },
  json: async () => opts.body ?? {},
} as unknown as NextRequest);

const authPayload = { sub: 'user-abc', kycVerified: true };
const authOk = () => mockJwt.mockResolvedValueOnce({ payload: authPayload } as any);
const gatewayOk = (data: unknown = {}) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => data } as any);
const gatewayFail = (status = 502) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status, json: async () => ({}) } as any);

// ────────────────────────────────────────────────────────────────
// assets/list
// ────────────────────────────────────────────────────────────────
describe('GET /api/bff/assets/list', () => {
  type GETFn = (r: NextRequest) => Promise<Response>;
  let GET: GETFn;

  beforeAll(async () => {
    process.env.JWT_SECRET        = 'test-jwt-secret-32-chars-long-xx';
    process.env.API_GATEWAY_URL   = GATEWAY;
    process.env.INTERNAL_SECRET   = 'internal-key';
    vi.resetModules();
    ({ GET } = await import('@/app/api/bff/assets/list/route'));
  });
  afterAll(() => { delete process.env.API_GATEWAY_URL; delete process.env.INTERNAL_SECRET; });
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without token', async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns assets list on success', async () => {
    authOk();
    const rawAsset = { id: 'a1', slug: 'nft-1', category: 'nft', status: 'active', metadata: { name: 'CoolNFT' }, createdAt: new Date().toISOString() };
    gatewayOk({ data: [rawAsset] });
    const res  = await GET(makeReq({ token: 'tok' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('CoolNFT');
    expect(body.total).toBe(1);
  });

  it('returns empty list on gateway failure', async () => {
    authOk();
    gatewayFail();
    const res  = await GET(makeReq({ token: 'tok' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────
// notifications/list
// ────────────────────────────────────────────────────────────────
describe('GET/PATCH /api/bff/notifications/list', () => {
  type Handlers = { GET: (r: NextRequest) => Promise<Response>; PATCH: (r: NextRequest) => Promise<Response> };
  let handlers: Handlers;

  beforeAll(async () => {
    process.env.JWT_SECRET      = 'test-jwt-secret-32-chars-long-xx';
    process.env.API_GATEWAY_URL = GATEWAY;
    vi.resetModules();
    handlers = await import('@/app/api/bff/notifications/list/route') as Handlers;
  });
  afterAll(() => { delete process.env.API_GATEWAY_URL; });
  beforeEach(() => vi.clearAllMocks());

  it('GET: returns 401 without token', async () => {
    const res = await handlers.GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('GET: returns notifications on success', async () => {
    authOk();
    gatewayOk({ notifications: [], unreadCount: 0 });
    const res = await handlers.GET(makeReq({ token: 'tok' }));
    expect(res.status).toBe(200);
  });

  it('GET: throws on gateway failure', async () => {
    authOk();
    gatewayFail(503);
    const res = await handlers.GET(makeReq({ token: 'tok' }));
    expect(res.status).toBe(500);
  });

  it('PATCH: returns 401 without token', async () => {
    const res = await handlers.PATCH(makeReq({ method: 'PATCH' }));
    expect(res.status).toBe(401);
  });

  it('PATCH: marks notification read on success', async () => {
    authOk();
    gatewayOk({ success: true });
    const res = await handlers.PATCH(makeReq({ token: 'tok', method: 'PATCH', body: { notificationId: 'n1' } }));
    expect(res.status).toBe(200);
  });
});

// ────────────────────────────────────────────────────────────────
// commerce/orders
// ────────────────────────────────────────────────────────────────
describe('GET/POST /api/bff/commerce/orders', () => {
  type Handlers = { GET: (r: NextRequest) => Promise<Response>; POST: (r: NextRequest) => Promise<Response> };
  let handlers: Handlers;

  beforeAll(async () => {
    process.env.JWT_SECRET      = 'test-jwt-secret-32-chars-long-xx';
    process.env.API_GATEWAY_URL = GATEWAY;
    vi.resetModules();
    handlers = await import('@/app/api/bff/commerce/orders/route') as Handlers;
  });
  afterAll(() => { delete process.env.API_GATEWAY_URL; });
  beforeEach(() => vi.clearAllMocks());

  it('GET: returns 401 without token', async () => {
    const res = await handlers.GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('GET: returns orders on success', async () => {
    authOk();
    gatewayOk({ orders: [], total: 0 });
    const res = await handlers.GET(makeReq({ token: 'tok' }));
    expect(res.status).toBe(200);
  });

  it('GET: throws on gateway failure', async () => {
    authOk();
    gatewayFail();
    const res = await handlers.GET(makeReq({ token: 'tok' }));
    expect(res.status).toBe(500);
  });

  it('POST: returns 403 when KYC not verified', async () => {
    mockJwt.mockResolvedValueOnce({ payload: { sub: 'u1', kycVerified: false } } as any);
    const res = await handlers.POST(makeReq({ token: 'tok', method: 'POST', body: { items: [{ productId: 'p1', qty: 1 }] } }));
    expect(res.status).toBe(403);
  });

  it('POST: creates order when KYC verified', async () => {
    authOk();
    gatewayOk({ order: { id: 'o1' } });
    const res = await handlers.POST(makeReq({ token: 'tok', method: 'POST', body: { items: [{ productId: 'p1', qty: 1 }] } }));
    expect(res.status).toBe(200);
  });
});

// ────────────────────────────────────────────────────────────────
// kyc/status
// ────────────────────────────────────────────────────────────────
describe('GET /api/bff/kyc/status', () => {
  type GETFn = (r: NextRequest) => Promise<Response>;
  let GET: GETFn;

  beforeAll(async () => {
    process.env.JWT_SECRET      = 'test-jwt-secret-32-chars-long-xx';
    process.env.API_GATEWAY_URL = GATEWAY;
    vi.resetModules();
    ({ GET } = await import('@/app/api/bff/kyc/status/route'));
  });
  afterAll(() => { delete process.env.API_GATEWAY_URL; });
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without token', async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns KYC status on success', async () => {
    authOk();
    gatewayOk({ status: 'APPROVED', level: 'KYC_1' });
    const res  = await GET(makeReq({ token: 'tok' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('APPROVED');
  });

  it('propagates gateway error', async () => {
    authOk();
    gatewayFail(503);
    const res = await GET(makeReq({ token: 'tok' }));
    expect(res.status).toBe(500);
  });
});

// ────────────────────────────────────────────────────────────────
// payments/history
// ────────────────────────────────────────────────────────────────
describe('GET /api/bff/payments/history', () => {
  type GETFn = (r: NextRequest) => Promise<Response>;
  let GET: GETFn;

  beforeAll(async () => {
    process.env.JWT_SECRET      = 'test-jwt-secret-32-chars-long-xx';
    process.env.API_GATEWAY_URL = GATEWAY;
    vi.resetModules();
    ({ GET } = await import('@/app/api/bff/payments/history/route'));
  });
  afterAll(() => { delete process.env.API_GATEWAY_URL; });
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without token', async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns payment history on success', async () => {
    authOk();
    gatewayOk({ payments: [], total: 0 });
    const res  = await GET(makeReq({ token: 'tok', search: 'limit=10&sort=desc' }));
    expect(res.status).toBe(200);
  });
});

// ────────────────────────────────────────────────────────────────
// wallet/balance
// ────────────────────────────────────────────────────────────────
describe('GET /api/bff/wallet/balance', () => {
  type GETFn = (r: NextRequest) => Promise<Response>;
  let GET: GETFn;

  beforeAll(async () => {
    process.env.JWT_SECRET      = 'test-jwt-secret-32-chars-long-xx';
    process.env.API_GATEWAY_URL = GATEWAY;
    vi.resetModules();
    ({ GET } = await import('@/app/api/bff/wallet/balance/route'));
  });
  afterAll(() => { delete process.env.API_GATEWAY_URL; });
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without token', async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns zero balance when gateway fails', async () => {
    authOk();
    gatewayFail(503);
    const res  = await GET(makeReq({ token: 'tok' }));
    const body = await res.json();
    expect(body.balance).toBe('0');
  });

  it('returns balance from PI wallet', async () => {
    authOk();
    const wallet = { id: 'w1', balance: 42.5, currency: 'PI', is_primary: true, wallet_address: 'addr1', updated_at: new Date().toISOString() };
    gatewayOk({ wallets: [wallet] });
    const res  = await GET(makeReq({ token: 'tok' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.balance).toBe('42.5');
    expect(body.walletId).toBe('w1');
  });
});

// ────────────────────────────────────────────────────────────────
// identity/profile
// ────────────────────────────────────────────────────────────────
describe('GET/PUT /api/bff/identity/profile', () => {
  type Handlers = {
    GET: (r: NextRequest) => Promise<Response>;
    PUT?: (r: NextRequest) => Promise<Response>;
  };
  let handlers: Handlers;

  beforeAll(async () => {
    process.env.JWT_SECRET      = 'test-jwt-secret-32-chars-long-xx';
    process.env.API_GATEWAY_URL = GATEWAY;
    vi.resetModules();
    handlers = await import('@/app/api/bff/identity/profile/route') as Handlers;
  });
  afterAll(() => { delete process.env.API_GATEWAY_URL; });
  beforeEach(() => vi.clearAllMocks());

  it('GET: returns 401 without token', async () => {
    const res = await handlers.GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('GET: returns profile on success', async () => {
    authOk();
    gatewayOk({ id: 'u1', username: 'alice' });
    const res = await handlers.GET(makeReq({ token: 'tok' }));
    expect(res.status).toBe(200);
  });
});

// ────────────────────────────────────────────────────────────────
// notifications/unread
// ────────────────────────────────────────────────────────────────
describe('GET /api/bff/notifications/unread', () => {
  type GETFn = (r: NextRequest) => Promise<Response>;
  let GET: GETFn;

  beforeAll(async () => {
    process.env.JWT_SECRET      = 'test-jwt-secret-32-chars-long-xx';
    process.env.API_GATEWAY_URL = GATEWAY;
    vi.resetModules();
    ({ GET } = await import('@/app/api/bff/notifications/unread/route'));
  });
  afterAll(() => { delete process.env.API_GATEWAY_URL; });
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without token', async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns unread count on success', async () => {
    authOk();
    gatewayOk({ count: 3 });
    const res  = await GET(makeReq({ token: 'tok' }));
    expect(res.status).toBe(200);
  });
});

// ────────────────────────────────────────────────────────────────
// bff/realtime — graceful when REALTIME_URL unset (NEW-T)
// ────────────────────────────────────────────────────────────────
describe('GET /api/bff/realtime', () => {
  type GETFn = (r: NextRequest) => Promise<Response>;

  beforeEach(() => { process.env.JWT_SECRET = 'test-jwt-secret-32-chars-long-xx'; });

  it('returns 200 enabled:false (NOT 500) when REALTIME_URL is unset', async () => {
    delete process.env.REALTIME_URL;
    vi.resetModules();
    const { GET } = await import('@/app/api/bff/realtime/route') as { GET: GETFn };
    authOk();
    const res  = await GET(makeReq({ token: 'tok' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.enabled).toBe(false);
    expect(body.url ?? null).toBeNull();
  });

  it('returns the url when REALTIME_URL is set', async () => {
    process.env.REALTIME_URL = 'wss://realtime.example';
    vi.resetModules();
    const { GET } = await import('@/app/api/bff/realtime/route') as { GET: GETFn };
    authOk();
    const res  = await GET(makeReq({ token: 'tok' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.enabled).toBe(true);
    expect(body.url).toBe('wss://realtime.example');
    delete process.env.REALTIME_URL;
  });
});

// ────────────────────────────────────────────────────────────────
// ai/context — personalization (own-scope, fail-soft)
// ────────────────────────────────────────────────────────────────
describe('GET /api/bff/ai/context', () => {
  type GETFn = (r: NextRequest) => Promise<Response>;
  let GET: GETFn;

  beforeAll(async () => {
    process.env.JWT_SECRET      = 'test-jwt-secret-32-chars-long-xx';
    process.env.API_GATEWAY_URL = GATEWAY;
    process.env.INTERNAL_SECRET = 'internal-key';
    vi.resetModules();
    ({ GET } = await import('@/app/api/bff/ai/context/route'));
  });
  afterAll(() => { delete process.env.API_GATEWAY_URL; delete process.env.INTERNAL_SECRET; });
  beforeEach(() => vi.clearAllMocks());

  // Per-URL gateway mock: goals / preferences / analytics overview.
  const gatewayByUrl = () =>
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) => {
      const url = String(input);
      const json = (data: unknown) => Promise.resolve({ ok: true, json: async () => data } as any);
      if (url.includes('/life/goals'))       return json([{ title: 'Save 100 Pi', done: false }, { title: 'Old', done: true }]);
      if (url.includes('/life/preferences')) return json({ focus: 'growth' });
      if (url.includes('/analytics/me/overview')) return json({ data: { logins: 12, payments: 3, volume: '45.5' } });
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) } as any);
    });

  it('returns 401 without token', async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('shapes own-scope goals + focus + activity (KYC from session)', async () => {
    authOk();
    gatewayByUrl();
    const res  = await GET(makeReq({ token: 'tok' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.kycVerified).toBe(true);         // from the verified JWT, not a param
    expect(body.goals).toEqual([
      { title: 'Save 100 Pi', done: false },
      { title: 'Old', done: true },
    ]);
    expect(body.focus).toBe('growth');
    expect(body.activity).toEqual({ logins: 12, payments: 3, volume: '45.5' });
  });

  it('fail-soft: returns base context when every upstream fails', async () => {
    authOk();
    gatewayFail(502);
    const res  = await GET(makeReq({ token: 'tok' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.kycVerified).toBe(true);
    expect(body.goals).toEqual([]);
    expect(body.focus ?? null).toBeNull();
    expect(body.activity ?? null).toBeNull();
  });
});
