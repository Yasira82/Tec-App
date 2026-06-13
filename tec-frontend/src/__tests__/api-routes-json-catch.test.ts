/**
 * API routes — json().catch(() => ({})) callbacks and outer error handlers.
 * Each test feeds a response whose json() throws so the catch path executes.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockIsE2eMode    = vi.hoisted(() => vi.fn(() => false));
const mockFetchTimeout = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/e2e-mode',           () => ({ isE2eMode:        mockIsE2eMode }));
vi.mock('@/lib/server/fetch-with-timeout', () => ({ fetchWithTimeout: mockFetchTimeout }));

interface ReqOpts {
  method?:  string;
  url?:     string;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  body?:    unknown;
  search?:  Record<string, string>;
}

function makeReq({
  method = 'GET',
  url = 'http://localhost/api/test',
  headers = {} as Record<string, string>,
  cookies = {} as Record<string, string>,
  body,
  search = {} as Record<string, string>,
}: ReqOpts = {}): NextRequest {
  const searchParams = new URLSearchParams(search);
  const searchStr    = searchParams.toString() ? `?${searchParams.toString()}` : '';
  return {
    method,
    url:     `${url}${searchStr}`,
    nextUrl: { origin: 'http://localhost', pathname: '/api/test', search: searchStr, searchParams },
    cookies: {
      get:    (name: string) => (cookies[name] !== undefined ? { value: cookies[name] } : undefined),
      getAll: () => Object.entries(cookies).map(([name, value]) => ({ name, value })),
    },
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? headers[name] ?? null,
    },
    json: async () => body,
  } as unknown as NextRequest;
}

const badJson = (status: number, ok = false) => ({
  ok, status,
  json: async () => { throw new Error('malformed gateway body'); },
});

beforeEach(() => {
  // resetAllMocks drains leftover mockResolvedValueOnce queues between tests
  vi.resetAllMocks();
  mockIsE2eMode.mockReturnValue(false);
});

describe('/api/payment/approve — malformed gateway bodies', () => {
  it('payment_id flow tolerates json-throwing approve response', async () => {
    mockFetchTimeout.mockResolvedValueOnce(badJson(502));
    const { POST } = await import('@/app/api/payment/approve/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { payment_id: 'p-1', pi_payment_id: 'pi-1' },
    }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({});
  });

  it('refresh helper tolerates json-throwing refresh response', async () => {
    mockFetchTimeout
      .mockResolvedValueOnce(badJson(401))            // approve → 401
      .mockResolvedValueOnce(badJson(200, true))      // refresh ok but body unreadable → token null
      .mockResolvedValue(badJson(200, true));
    const { POST } = await import('@/app/api/payment/approve/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok', tec_csrf: 'c' },
      body:    { payment_id: 'p-1' },
    }));
    expect(res.status).toBe(401); // refresh produced no token → session expired
  });

  it('refresh helper swallows network errors', async () => {
    mockFetchTimeout
      .mockResolvedValueOnce(badJson(401))
      .mockRejectedValueOnce(new Error('refresh network down'));
    const { POST } = await import('@/app/api/payment/approve/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { payment_id: 'p-1' },
    }));
    expect(res.status).toBe(401);
  });

  it('corrupted tec_user cookie is ignored in the piId flow', async () => {
    mockFetchTimeout
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { payment: { id: 'db-1' } } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) });
    const { POST } = await import('@/app/api/payment/approve/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok', tec_user: '%7Bbroken' },
      body:    { paymentId: 'pi-xyz', amount: 1, userId: 'u-1' },
    }));
    expect([200, 400, 500]).toContain(res.status);
  });

  it('piId flow tolerates json-throwing create response', async () => {
    mockFetchTimeout.mockResolvedValueOnce(badJson(503));
    const { POST } = await import('@/app/api/payment/approve/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok', tec_user: encodeURIComponent(JSON.stringify({ id: 'u-1' })) },
      body:    { paymentId: 'pi-xyz', amount: 1 },
    }));
    expect(res.status).toBe(503);
  });

  it('piId flow tolerates json-throwing approve response after create', async () => {
    mockFetchTimeout
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { payment: { id: 'db-2' } } }) })
      .mockResolvedValueOnce(badJson(500));
    const { POST } = await import('@/app/api/payment/approve/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok', tec_user: encodeURIComponent(JSON.stringify({ id: 'u-1' })) },
      body:    { paymentId: 'pi-xyz', amount: 1 },
    }));
    const data = await res.json();
    expect(data.payment_id).toBe('db-2');
    expect(res.status).toBe(500);
  });
});

describe('/api/payment/create — malformed bodies and cookie parse', () => {
  it('tolerates json-throwing gateway create response', async () => {
    mockFetchTimeout.mockResolvedValueOnce(badJson(502));
    const { POST } = await import('@/app/api/payment/create/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: {
        tec_access_token: 'tok',
        tec_user: encodeURIComponent(JSON.stringify({ id: 'u-1' })),
      },
      body: { amount: 1, currency: 'PI', payment_method: 'pi' },
    }));
    expect(res.status).toBe(502);
  });

  it('handles corrupted tec_user cookie gracefully', async () => {
    mockFetchTimeout.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { id: 'p' } }) });
    const { POST } = await import('@/app/api/payment/create/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok', tec_user: '%7Bbroken' },
      body:    { amount: 1, currency: 'PI', payment_method: 'pi', userId: 'u-1' },
    }));
    expect([200, 400, 401]).toContain(res.status);
  });

  it('refresh path tolerates json-throwing refresh body', async () => {
    mockFetchTimeout
      .mockResolvedValueOnce(badJson(401))        // create → 401
      .mockResolvedValueOnce(badJson(200, true)); // refresh body unreadable
    const { POST } = await import('@/app/api/payment/create/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: {
        tec_access_token: 'tok',
        tec_user: encodeURIComponent(JSON.stringify({ id: 'u-1' })),
      },
      body: { amount: 1, currency: 'PI', payment_method: 'pi' },
    }));
    expect(res.status).toBe(401);
  });

  it('refresh path swallows refresh network error', async () => {
    mockFetchTimeout
      .mockResolvedValueOnce(badJson(401))
      .mockRejectedValueOnce(new Error('down'));
    const { POST } = await import('@/app/api/payment/create/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: {
        tec_access_token: 'tok',
        tec_user: encodeURIComponent(JSON.stringify({ id: 'u-1' })),
      },
      body: { amount: 1, currency: 'PI', payment_method: 'pi' },
    }));
    expect(res.status).toBe(401);
  });
});

describe('/api/wallet/balance — malformed bodies and exception path', () => {
  const authed = { headers: { authorization: 'Bearer tok' } };

  it('returns zero balance when gateway error body is unreadable', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchTimeout.mockResolvedValueOnce(badJson(503));
    const { GET } = await import('@/app/api/wallet/balance/route');
    const res = await GET(makeReq({
      ...authed,
      cookies: { tec_user: encodeURIComponent(JSON.stringify({ id: 'u-1' })) },
    }));
    const data = await res.json();
    expect(data.balance).toBe('0');
    errSpy.mockRestore();
  });

  it('returns zero balance when success body is unreadable', async () => {
    mockFetchTimeout.mockResolvedValueOnce(badJson(200, true));
    const { GET } = await import('@/app/api/wallet/balance/route');
    const res = await GET(makeReq({
      ...authed,
      cookies: { tec_user: encodeURIComponent(JSON.stringify({ id: 'u-1' })) },
    }));
    const data = await res.json();
    expect(data.balance).toBe('0');
    expect(data.walletId).toBeNull();
  });

  it('returns zero balance when gateway throws (outer catch)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchTimeout.mockRejectedValueOnce(new Error('gateway exploded'));
    const { GET } = await import('@/app/api/wallet/balance/route');
    const res = await GET(makeReq({
      ...authed,
      cookies: { tec_user: encodeURIComponent(JSON.stringify({ id: 'u-1' })) },
    }));
    const data = await res.json();
    expect(data.balance).toBe('0');
    errSpy.mockRestore();
  });

  it('falls back to userId query param when tec_user cookie corrupted', async () => {
    mockFetchTimeout.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ wallets: [{ id: 'w1', balance: 3, currency: 'PI', is_primary: true, updated_at: '2024-01-01', wallet_address: null, wallet_type: 'pi' }] }),
    });
    const { GET } = await import('@/app/api/wallet/balance/route');
    const res = await GET(makeReq({
      ...authed,
      cookies: { tec_user: '%7Bbroken' },
      search:  { userId: 'u-9' },
    }));
    const data = await res.json();
    expect(data.balance).toBe(3);
  });
});

describe('/api/auth/pi-login — malformed body and outer catch', () => {
  it('passes through backend status when error body unreadable', async () => {
    mockFetchTimeout.mockResolvedValueOnce(badJson(403));
    const { POST } = await import('@/app/api/auth/pi-login/route');
    const res = await POST(makeReq({
      method: 'POST',
      body:   { accessToken: 'pi-tok' },
    }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({});
  });

  it('returns 500 when request body parsing throws (outer catch)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { POST } = await import('@/app/api/auth/pi-login/route');
    const req = makeReq({ method: 'POST' });
    (req as any).json = async () => { throw new Error('bad request body'); };
    const res = await POST(req);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Auth failed');
    errSpy.mockRestore();
  });
});
