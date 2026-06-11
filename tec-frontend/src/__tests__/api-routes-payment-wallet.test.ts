/**
 * Coverage for 0% payment/wallet routes + robots/sitemap
 *
 * Routes covered:
 *   /api/payment/a2u
 *   /api/payment/cancel
 *   /api/payment/complete
 *   /api/payment/create
 *   /api/payment/resolve
 *   /api/payment/resolve-incomplete
 *   /api/payments/history
 *   /api/wallet/lookup
 *   /api/wallet/transactions
 *   /api/wallet/transfer
 *   /app/robots.ts
 *   /app/sitemap.ts
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ─────────────────────────────────────────────────────────
const mockIsE2eMode    = vi.hoisted(() => vi.fn(() => false));
const mockFetchTimeout = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/e2e-mode',           () => ({ isE2eMode:       mockIsE2eMode }));
vi.mock('@/lib/server/fetch-with-timeout', () => ({ fetchWithTimeout: mockFetchTimeout }));

// ── Helpers ───────────────────────────────────────────────────────────────

/** Build a base64url JWT — used for token payload parsing in payment/create */
function makeJwt(payload: Record<string, unknown>): string {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
  const b = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${h}.${b}.sig`;
}

interface ReqOpts {
  method?:  string;
  url?:     string;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  body?:    unknown;
  search?:  Record<string, string>;
}

/**
 * Builds a mock NextRequest-compatible object — same pattern as api-routes-batch.test.ts.
 * Avoids relying on NextRequest's real Cookie header parsing (which doesn't work in vitest).
 */
function makeReq({
  method  = 'GET',
  url     = 'http://localhost/api/test',
  headers = {} as Record<string, string>,
  cookies = {} as Record<string, string>,
  body,
  search  = {} as Record<string, string>,
}: ReqOpts = {}): NextRequest {
  const searchParams = new URLSearchParams(search);
  const searchStr    = searchParams.toString() ? `?${searchParams.toString()}` : '';

  return {
    method,
    url:     `${url}${searchStr}`,
    nextUrl: {
      origin:       'http://localhost',
      pathname:     '/api/test',
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

/** Successful gateway mock response */
const gw = (data: unknown = {}, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: async () => data }) as ReturnType<typeof fetch>;

/** Error gateway mock response */
const gwErr = (status = 503) =>
  Promise.resolve({ ok: false, status, json: async () => ({ error: 'e' }) }) as ReturnType<typeof fetch>;

// ── Setup ─────────────────────────────────────────────────────────────────

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockIsE2eMode.mockReturnValue(false);
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => gw());
});

// ─────────────────────────────────────────────────────────────────────────
// 1. /api/payment/a2u  (global fetch, cookie auth)
// ─────────────────────────────────────────────────────────────────────────
describe('/api/payment/a2u', () => {
  it('returns 401 when no tec_access_token cookie', async () => {
    const { POST } = await import('@/app/api/payment/a2u/route');
    const res = await POST(makeReq({ method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when recipientUid missing', async () => {
    const { POST } = await import('@/app/api/payment/a2u/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { amount: 5 },
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/recipientUid/);
  });

  it('returns 400 when amount is not a positive number', async () => {
    const { POST } = await import('@/app/api/payment/a2u/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { recipientUid: 'u1', amount: -1 },
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Amount/);
  });

  it('returns 400 when amount is zero', async () => {
    const { POST } = await import('@/app/api/payment/a2u/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { recipientUid: 'u1', amount: 0 },
    }));
    expect(res.status).toBe(400);
  });

  it('proxies gateway response on success', async () => {
    const { POST } = await import('@/app/api/payment/a2u/route');
    fetchSpy.mockResolvedValue(gw({ payment_id: 'p-a2u' }));
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { recipientUid: 'u1', amount: 5 },
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.payment_id).toBe('p-a2u');
  });

  it('returns 503 on fetch network error', async () => {
    const { POST } = await import('@/app/api/payment/a2u/route');
    fetchSpy.mockRejectedValue(new Error('network fail'));
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { recipientUid: 'u1', amount: 5 },
    }));
    expect(res.status).toBe(503);
  });

  it('forwards custom idempotency-key header to gateway', async () => {
    const { POST } = await import('@/app/api/payment/a2u/route');
    fetchSpy.mockResolvedValue(gw({}));
    await POST(makeReq({
      method:  'POST',
      headers: { 'idempotency-key': 'custom-key-123' },
      cookies: { tec_access_token: 'tok' },
      body:    { recipientUid: 'u1', amount: 1 },
    }));
    expect(fetchSpy).toHaveBeenCalled();
    const callHeaders = (fetchSpy.mock.calls[0] as unknown[])[1] as RequestInit & { headers?: Record<string, string> };
    expect(callHeaders?.headers?.['Idempotency-Key']).toBe('custom-key-123');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. /api/payment/cancel  (isE2eMode + fetchWithTimeout, header auth)
// ─────────────────────────────────────────────────────────────────────────
describe('/api/payment/cancel', () => {
  it('returns 401 when no authorization header', async () => {
    const { POST } = await import('@/app/api/payment/cancel/route');
    const res = await POST(makeReq({ method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('returns 200 stub in e2e mode', async () => {
    const { POST } = await import('@/app/api/payment/cancel/route');
    mockIsE2eMode.mockReturnValue(true);
    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: 'Bearer tok' },
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.status).toBe('cancelled');
    expect(mockFetchTimeout).not.toHaveBeenCalled();
  });

  it('returns 400 when pi_payment_id missing', async () => {
    const { POST } = await import('@/app/api/payment/cancel/route');
    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: 'Bearer tok' },
      body:    {},
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/pi_payment_id/);
  });

  it('proxies gateway response on success', async () => {
    const { POST } = await import('@/app/api/payment/cancel/route');
    mockFetchTimeout.mockResolvedValue(gw({ status: 'cancelled' }));
    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: 'Bearer tok' },
      body:    { pi_payment_id: 'pi-123' },
    }));
    expect(res.status).toBe(200);
  });

  it('returns 503 on fetchWithTimeout network error', async () => {
    const { POST } = await import('@/app/api/payment/cancel/route');
    mockFetchTimeout.mockRejectedValue(new Error('timeout'));
    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: 'Bearer tok' },
      body:    { pi_payment_id: 'pi-123' },
    }));
    expect(res.status).toBe(503);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 3. /api/payment/complete  (isE2eMode + fetchWithTimeout, cookie or header)
// ─────────────────────────────────────────────────────────────────────────
describe('/api/payment/complete', () => {
  it('returns 401 when no auth', async () => {
    const { POST } = await import('@/app/api/payment/complete/route');
    const res = await POST(makeReq({ method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('returns 200 stub in e2e mode via cookie auth', async () => {
    const { POST } = await import('@/app/api/payment/complete/route');
    mockIsE2eMode.mockReturnValue(true);
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.status).toBe('completed');
    expect(mockFetchTimeout).not.toHaveBeenCalled();
  });

  it('returns 200 stub in e2e mode via authorization header', async () => {
    const { POST } = await import('@/app/api/payment/complete/route');
    mockIsE2eMode.mockReturnValue(true);
    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: 'Bearer tok' },
    }));
    expect(res.status).toBe(200);
  });

  it('proxies gateway response with authorization header', async () => {
    const { POST } = await import('@/app/api/payment/complete/route');
    mockFetchTimeout.mockResolvedValue(gw({ status: 'completed' }, 200));
    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: 'Bearer tok' },
      body:    { pi_payment_id: 'pi-xyz' },
    }));
    expect(res.status).toBe(200);
    expect(mockFetchTimeout).toHaveBeenCalled();
  });

  it('returns 503 on fetchWithTimeout network error', async () => {
    const { POST } = await import('@/app/api/payment/complete/route');
    mockFetchTimeout.mockRejectedValue(new Error('fail'));
    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: 'Bearer tok' },
      body:    { pi_payment_id: 'pi-xyz' },
    }));
    expect(res.status).toBe(503);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 4. /api/payment/resolve-incomplete  (isE2eMode + fetchWithTimeout)
// ─────────────────────────────────────────────────────────────────────────
describe('/api/payment/resolve-incomplete', () => {
  it('returns 401 when no authorization header', async () => {
    const { POST } = await import('@/app/api/payment/resolve-incomplete/route');
    const res = await POST(makeReq({ method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('returns 200 stub in e2e mode', async () => {
    const { POST } = await import('@/app/api/payment/resolve-incomplete/route');
    mockIsE2eMode.mockReturnValue(true);
    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: 'Bearer tok' },
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.action).toBe('no_action_needed');
  });

  it('returns 400 when no pi_payment_id provided', async () => {
    const { POST } = await import('@/app/api/payment/resolve-incomplete/route');
    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: 'Bearer tok' },
      body:    {},
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/pi_payment_id/);
  });

  it('reads pi_payment_id from query string', async () => {
    const { POST } = await import('@/app/api/payment/resolve-incomplete/route');
    mockFetchTimeout.mockResolvedValue(gw({ action: 'resolved' }));
    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: 'Bearer tok' },
      search:  { pi_payment_id: 'pi-query' },
    }));
    expect(res.status).toBe(200);
  });

  it('reads pi_payment_id from body', async () => {
    const { POST } = await import('@/app/api/payment/resolve-incomplete/route');
    mockFetchTimeout.mockResolvedValue(gw({ action: 'resolved' }));
    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: 'Bearer tok' },
      body:    { pi_payment_id: 'pi-body' },
    }));
    expect(res.status).toBe(200);
  });

  it('returns 503 on fetchWithTimeout network error', async () => {
    const { POST } = await import('@/app/api/payment/resolve-incomplete/route');
    mockFetchTimeout.mockRejectedValue(new Error('timeout'));
    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: 'Bearer tok' },
      body:    { pi_payment_id: 'pi-b' },
    }));
    expect(res.status).toBe(503);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 5. /api/payment/resolve  (fetchWithTimeout, cookie first then header)
// ─────────────────────────────────────────────────────────────────────────
describe('/api/payment/resolve', () => {
  it('returns 401 when no cookie and no header', async () => {
    const { POST } = await import('@/app/api/payment/resolve/route');
    const res = await POST(makeReq({ method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('accepts cookie auth (preferred over header)', async () => {
    const { POST } = await import('@/app/api/payment/resolve/route');
    mockFetchTimeout.mockResolvedValue(gw({ status: 'resolved' }));
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { pi_payment_id: 'pi-123' },
    }));
    expect(res.status).toBe(200);
  });

  it('falls back to Authorization header when no cookie', async () => {
    const { POST } = await import('@/app/api/payment/resolve/route');
    mockFetchTimeout.mockResolvedValue(gw({ status: 'resolved' }));
    const res = await POST(makeReq({
      method:  'POST',
      headers: { Authorization: 'Bearer tok' },
      body:    { pi_payment_id: 'pi-123' },
    }));
    expect(res.status).toBe(200);
  });

  it('returns 400 when pi_payment_id missing', async () => {
    const { POST } = await import('@/app/api/payment/resolve/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    {},
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/pi_payment_id/);
  });

  it('returns 503 on fetchWithTimeout network error', async () => {
    const { POST } = await import('@/app/api/payment/resolve/route');
    mockFetchTimeout.mockRejectedValue(new Error('timeout'));
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { pi_payment_id: 'pi-123' },
    }));
    expect(res.status).toBe(503);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 6. /api/payment/create  (complex: userId resolve + refresh retry logic)
// ─────────────────────────────────────────────────────────────────────────
describe('/api/payment/create', () => {
  const validBody = { amount: 5, currency: 'PI', payment_method: 'pi_browser' };
  const userId    = 'user-123';
  const userJwt   = makeJwt({ sub: userId });

  it('returns 401 when no auth', async () => {
    const { POST } = await import('@/app/api/payment/create/route');
    const res = await POST(makeReq({ method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('returns 401 when userId cannot be resolved from token or cookie', async () => {
    const { POST } = await import('@/app/api/payment/create/route');
    const badJwt = makeJwt({ foo: 'bar' }); // no sub / id field
    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: `Bearer ${badJwt}` },
      body:    validBody,
    }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/userId/);
  });

  it('returns 400 when required fields missing', async () => {
    const { POST } = await import('@/app/api/payment/create/route');
    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: `Bearer ${userJwt}` },
      body:    { amount: 5 }, // missing currency + payment_method
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.missing).toContain('currency');
    expect(data.missing).toContain('payment_method');
  });

  it('returns 201 stub in e2e mode', async () => {
    const { POST } = await import('@/app/api/payment/create/route');
    mockIsE2eMode.mockReturnValue(true);
    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: `Bearer ${userJwt}` },
      body:    validBody,
    }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.status).toBe('pending');
    expect(mockFetchTimeout).not.toHaveBeenCalled();
  });

  it('proxies gateway response on success', async () => {
    const { POST } = await import('@/app/api/payment/create/route');
    mockFetchTimeout.mockResolvedValue(gw({ payment_id: 'p-1' }, 201));
    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: `Bearer ${userJwt}` },
      body:    validBody,
    }));
    expect(res.status).toBe(201);
  });

  it('retries with refreshed token after initial 401', async () => {
    const { POST } = await import('@/app/api/payment/create/route');
    mockFetchTimeout
      .mockResolvedValueOnce(gw({}, 401))                                    // initial create → 401
      .mockResolvedValueOnce(gw({ tokens: { accessToken: 'new-tok' } }))     // refresh call
      .mockResolvedValueOnce(gw({ payment_id: 'p-retry' }, 201));            // retry create

    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: `Bearer ${userJwt}` },
      cookies: { tec_refresh_token: 'refresh-tok' },
      body:    validBody,
    }));
    expect(res.status).toBe(201);
    expect(mockFetchTimeout).toHaveBeenCalledTimes(3);
  });

  it('returns 401 when initial create gets 401 and no refresh token available', async () => {
    const { POST } = await import('@/app/api/payment/create/route');
    mockFetchTimeout.mockResolvedValue(gw({}, 401));
    // no tec_refresh_token cookie → refreshAccessToken returns null immediately
    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: `Bearer ${userJwt}` },
      body:    validBody,
    }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/Session expired/);
  });

  it('returns 401 when refresh call itself fails', async () => {
    const { POST } = await import('@/app/api/payment/create/route');
    mockFetchTimeout
      .mockResolvedValueOnce(gw({}, 401))    // initial create → 401
      .mockResolvedValueOnce(gwErr(400));     // refresh call fails

    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: `Bearer ${userJwt}` },
      cookies: { tec_refresh_token: 'refresh-tok' },
      body:    validBody,
    }));
    expect(res.status).toBe(401);
  });

  it('resolves userId from tec_user cookie when header auth used', async () => {
    const { POST } = await import('@/app/api/payment/create/route');
    mockFetchTimeout.mockResolvedValue(gw({ payment_id: 'p-cu' }, 201));
    const userCookie = encodeURIComponent(JSON.stringify({ id: 'cookie-user' }));
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'raw-tok', tec_user: userCookie },
      body:    validBody,
    }));
    expect(res.status).toBe(201);
  });

  it('returns 503 on fetchWithTimeout network error', async () => {
    const { POST } = await import('@/app/api/payment/create/route');
    mockFetchTimeout.mockRejectedValue(new Error('network fail'));
    const res = await POST(makeReq({
      method:  'POST',
      headers: { authorization: `Bearer ${userJwt}` },
      body:    validBody,
    }));
    expect(res.status).toBe(503);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 7. /api/payments/history  (global fetch, Authorization header)
// ─────────────────────────────────────────────────────────────────────────
describe('/api/payments/history', () => {
  it('returns 401 when no authorization header', async () => {
    const { GET } = await import('@/app/api/payments/history/route');
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('proxies gateway response on success', async () => {
    const { GET } = await import('@/app/api/payments/history/route');
    fetchSpy.mockResolvedValue(gw({ payments: [{ id: 'p1' }] }));
    const res = await GET(makeReq({ headers: { authorization: 'Bearer tok' } }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.payments).toHaveLength(1);
  });

  it('forwards query string to gateway', async () => {
    const { GET } = await import('@/app/api/payments/history/route');
    fetchSpy.mockResolvedValue(gw({ payments: [] }));
    await GET(makeReq({
      headers: { authorization: 'Bearer tok' },
      search:  { page: '2', limit: '5' },
    }));
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('page=2'),
      expect.anything(),
    );
  });

  it('returns 503 on fetch network error', async () => {
    const { GET } = await import('@/app/api/payments/history/route');
    fetchSpy.mockRejectedValue(new Error('network'));
    const res = await GET(makeReq({ headers: { authorization: 'Bearer tok' } }));
    expect(res.status).toBe(503);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 8. /api/wallet/lookup  (global fetch, cookie auth, piUsername resolution)
// ─────────────────────────────────────────────────────────────────────────
describe('/api/wallet/lookup', () => {
  it('returns 401 when no tec_access_token cookie', async () => {
    const { GET } = await import('@/app/api/wallet/lookup/route');
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns 400 when neither userId nor piUsername provided', async () => {
    const { GET } = await import('@/app/api/wallet/lookup/route');
    const res = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/userId or piUsername/);
  });

  it('looks up wallet by userId directly', async () => {
    const { GET } = await import('@/app/api/wallet/lookup/route');
    fetchSpy.mockResolvedValue(gw({
      data: { wallets: [{ id: 'w-1', is_primary: true }] },
    }));
    const res = await GET(makeReq({
      cookies: { tec_access_token: 'tok' },
      search:  { userId: 'u-1' },
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.walletId).toBe('w-1');
    expect(data.userId).toBe('u-1');
  });

  it('resolves piUsername to userId then looks up wallet', async () => {
    const { GET } = await import('@/app/api/wallet/lookup/route');
    fetchSpy
      .mockResolvedValueOnce(gw({ data: { id: 'u-resolved' } }))
      .mockResolvedValueOnce(gw({ data: { wallets: [{ id: 'w-2', is_primary: true }] } }));
    const res = await GET(makeReq({
      cookies: { tec_access_token: 'tok' },
      search:  { piUsername: 'pi-user' },
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.walletId).toBe('w-2');
    expect(data.userId).toBe('u-resolved');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('returns 404 when piUsername user not found', async () => {
    const { GET } = await import('@/app/api/wallet/lookup/route');
    fetchSpy.mockResolvedValue(gw({})); // no data.id → user not found
    const res = await GET(makeReq({
      cookies: { tec_access_token: 'tok' },
      search:  { piUsername: 'nobody' },
    }));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toMatch(/not found/i);
  });

  it('returns 404 when wallet list is empty', async () => {
    const { GET } = await import('@/app/api/wallet/lookup/route');
    fetchSpy.mockResolvedValue(gw({ data: { wallets: [] } }));
    const res = await GET(makeReq({
      cookies: { tec_access_token: 'tok' },
      search:  { userId: 'u-1' },
    }));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toMatch(/Wallet not found/);
  });

  it('picks first wallet as fallback when no is_primary flag', async () => {
    const { GET } = await import('@/app/api/wallet/lookup/route');
    fetchSpy.mockResolvedValue(gw({
      data: { wallets: [{ id: 'w-fallback' }] },
    }));
    const res = await GET(makeReq({
      cookies: { tec_access_token: 'tok' },
      search:  { userId: 'u-1' },
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.walletId).toBe('w-fallback');
  });

  it('returns 503 on fetch network error', async () => {
    const { GET } = await import('@/app/api/wallet/lookup/route');
    fetchSpy.mockRejectedValue(new Error('fail'));
    const res = await GET(makeReq({
      cookies: { tec_access_token: 'tok' },
      search:  { userId: 'u-1' },
    }));
    expect(res.status).toBe(503);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 9. /api/wallet/transactions  (fetchWithTimeout, cookie auth)
// ─────────────────────────────────────────────────────────────────────────
describe('/api/wallet/transactions', () => {
  it('returns 401 when no tec_access_token cookie', async () => {
    const { GET } = await import('@/app/api/wallet/transactions/route');
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns 400 when walletId missing', async () => {
    const { GET } = await import('@/app/api/wallet/transactions/route');
    const res = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/walletId/);
  });

  it('proxies gateway response on success', async () => {
    const { GET } = await import('@/app/api/wallet/transactions/route');
    mockFetchTimeout.mockResolvedValue(gw({ transactions: [{ id: 't1' }] }));
    const res = await GET(makeReq({
      cookies: { tec_access_token: 'tok' },
      search:  { walletId: 'w-1' },
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.transactions).toHaveLength(1);
  });

  it('passes page and limit defaults to gateway URL', async () => {
    const { GET } = await import('@/app/api/wallet/transactions/route');
    mockFetchTimeout.mockResolvedValue(gw({ transactions: [] }));
    await GET(makeReq({
      cookies: { tec_access_token: 'tok' },
      search:  { walletId: 'w-1' },
    }));
    expect(mockFetchTimeout).toHaveBeenCalledWith(
      expect.stringContaining('page=1'),
      expect.anything(),
    );
  });

  it('returns 503 on fetchWithTimeout network error', async () => {
    const { GET } = await import('@/app/api/wallet/transactions/route');
    mockFetchTimeout.mockRejectedValue(new Error('timeout'));
    const res = await GET(makeReq({
      cookies: { tec_access_token: 'tok' },
      search:  { walletId: 'w-1' },
    }));
    expect(res.status).toBe(503);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 10. /api/wallet/transfer  (global fetch, cookie auth, body validation)
// ─────────────────────────────────────────────────────────────────────────
describe('/api/wallet/transfer', () => {
  it('returns 401 when no tec_access_token cookie', async () => {
    const { POST } = await import('@/app/api/wallet/transfer/route');
    const res = await POST(makeReq({ method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when fromWalletId missing', async () => {
    const { POST } = await import('@/app/api/wallet/transfer/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { toWalletId: 'w-2', amount: 5 },
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/fromWalletId/);
  });

  it('returns 400 when toWalletId missing', async () => {
    const { POST } = await import('@/app/api/wallet/transfer/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { fromWalletId: 'w-1', amount: 5 },
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/toWalletId/);
  });

  it('returns 400 when amount is zero', async () => {
    const { POST } = await import('@/app/api/wallet/transfer/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { fromWalletId: 'w-1', toWalletId: 'w-2', amount: 0 },
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Amount/);
  });

  it('returns 400 when amount is negative', async () => {
    const { POST } = await import('@/app/api/wallet/transfer/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { fromWalletId: 'w-1', toWalletId: 'w-2', amount: -10 },
    }));
    expect(res.status).toBe(400);
  });

  it('proxies gateway response on success', async () => {
    const { POST } = await import('@/app/api/wallet/transfer/route');
    fetchSpy.mockResolvedValue(gw({ transferId: 'tx-1' }));
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { fromWalletId: 'w-1', toWalletId: 'w-2', amount: 5 },
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.transferId).toBe('tx-1');
  });

  it('returns 503 on fetch network error', async () => {
    const { POST } = await import('@/app/api/wallet/transfer/route');
    fetchSpy.mockRejectedValue(new Error('fail'));
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { fromWalletId: 'w-1', toWalletId: 'w-2', amount: 5 },
    }));
    expect(res.status).toBe(503);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 11. /app/robots.ts
// ─────────────────────────────────────────────────────────────────────────
describe('robots.ts', () => {
  it('returns correct robots rules structure', async () => {
    const { default: robots } = await import('@/app/robots');
    const result = robots();
    expect(result).toBeDefined();
    const rules = result.rules as Array<{ userAgent?: string; allow?: string[]; disallow?: string[] }>;
    expect(Array.isArray(rules)).toBe(true);
    expect(rules[0].userAgent).toBe('*');
    expect(rules[0].allow).toContain('/');
    expect(rules[0].disallow).toContain('/api/');
  });

  it('includes sitemap URL ending in sitemap.xml', async () => {
    const { default: robots } = await import('@/app/robots');
    const result = robots();
    expect(typeof result.sitemap).toBe('string');
    expect((result.sitemap as string)).toMatch(/sitemap\.xml$/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 12. /app/sitemap.ts
// ─────────────────────────────────────────────────────────────────────────
describe('sitemap.ts', () => {
  it('returns an array of sitemap entries', async () => {
    const { default: sitemap } = await import('@/app/sitemap');
    const result = sitemap();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('each entry has url, lastModified, changeFrequency, and priority', async () => {
    const { default: sitemap } = await import('@/app/sitemap');
    const result = sitemap();
    for (const entry of result) {
      expect(typeof entry.url).toBe('string');
      expect(entry.url.length).toBeGreaterThan(0);
      expect(entry.lastModified).toBeDefined();
      expect(entry.changeFrequency).toBeDefined();
      expect(typeof entry.priority).toBe('number');
    }
  });

  it('includes privacy and terms pages', async () => {
    const { default: sitemap } = await import('@/app/sitemap');
    const result = sitemap();
    const urls   = result.map(e => e.url);
    expect(urls.some(u => u.includes('/privacy'))).toBe(true);
    expect(urls.some(u => u.includes('/terms'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 13. /api/notifications/unread-count  (global fetch, cookie auth)
// ─────────────────────────────────────────────────────────────────────────
describe('/api/notifications/unread-count', () => {
  it('returns count 0 when no tec_access_token cookie', async () => {
    const { GET } = await import('@/app/api/notifications/unread-count/route');
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.count).toBe(0);
  });

  it('returns correct unread count from gateway', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          notifications: [
            { read: false },
            { read: true },
            { read: false },
          ],
        },
      }),
    } as any);
    const { GET } = await import('@/app/api/notifications/unread-count/route');
    const res  = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    const json = await res.json();
    expect(json.count).toBe(2);
  });

  it('returns count 0 when gateway response is not ok', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) } as any);
    const { GET } = await import('@/app/api/notifications/unread-count/route');
    const res  = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    const json = await res.json();
    expect(json.count).toBe(0);
  });

  it('returns count 0 when gateway throws', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network error'));
    const { GET } = await import('@/app/api/notifications/unread-count/route');
    const res  = await GET(makeReq({ cookies: { tec_access_token: 'tok' } }));
    const json = await res.json();
    expect(json.count).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 14. /api/payment/approve  (fetchWithTimeout, isE2eMode, cookie + header auth)
// ─────────────────────────────────────────────────────────────────────────
describe('/api/payment/approve', () => {
  it('returns 401 when no Authorization header or cookie', async () => {
    const { POST } = await import('@/app/api/payment/approve/route');
    const res = await POST(makeReq({ method: 'POST', body: { payment_id: 'p-1' } }));
    expect(res.status).toBe(401);
  });

  it('e2eMode + payment_id → success without calling gateway', async () => {
    mockIsE2eMode.mockReturnValue(true);
    const { POST } = await import('@/app/api/payment/approve/route');
    const res  = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { payment_id: 'p-1', pi_payment_id: 'pi-1' },
    }));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockFetchTimeout).not.toHaveBeenCalled();
  });

  it('payment_id flow: gateway approve succeeds', async () => {
    mockFetchTimeout.mockResolvedValueOnce(gw({ success: true, status: 'approved' }));
    const { POST } = await import('@/app/api/payment/approve/route');
    const res  = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { payment_id: 'p-1', pi_payment_id: 'pi-1' },
    }));
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('payment_id flow: 401 → refresh → retry succeeds', async () => {
    mockFetchTimeout
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })       // initial approve 401
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ token: 'new-tok' }) }) // refresh
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) });    // retry approve

    const { POST } = await import('@/app/api/payment/approve/route');
    const res  = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok', tec_csrf: 'csrf-val' },
      body:    { payment_id: 'p-1' },
    }));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockFetchTimeout).toHaveBeenCalledTimes(3);
  });

  it('payment_id flow: 401 and refresh fails → 401', async () => {
    mockFetchTimeout
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) }); // refresh fails

    const { POST } = await import('@/app/api/payment/approve/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { payment_id: 'p-1' },
    }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when neither payment_id nor paymentId provided', async () => {
    const { POST } = await import('@/app/api/payment/approve/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    {},
    }));
    expect(res.status).toBe(400);
  });

  it('e2eMode + paymentId → success without gateway', async () => {
    mockIsE2eMode.mockReturnValue(true);
    const { POST } = await import('@/app/api/payment/approve/route');
    const res  = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { paymentId: 'pi-123', amount: 5 },
    }));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.payment_id).toBeDefined();
  });

  it('piId flow: create + approve succeeds', async () => {
    mockFetchTimeout
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ data: { payment: { id: 'db-id' } } }) }) // create
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, status: 'approved' }) });  // approve

    const { POST } = await import('@/app/api/payment/approve/route');
    const res  = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok', tec_user: encodeURIComponent(JSON.stringify({ id: 'u-1' })) },
      body:    { paymentId: 'pi-123', amount: 5 },
    }));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.payment_id).toBe('db-id');
  });

  it('piId flow: create fails → returns error', async () => {
    mockFetchTimeout.mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ error: 'invalid' }) }); // create fails

    const { POST } = await import('@/app/api/payment/approve/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { paymentId: 'pi-123' },
    }));
    expect(res.status).toBe(422);
  });

  it('piId flow: create success but no payment ID → 500', async () => {
    mockFetchTimeout.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) }); // no ID in response

    const { POST } = await import('@/app/api/payment/approve/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_access_token: 'tok' },
      body:    { paymentId: 'pi-123' },
    }));
    expect(res.status).toBe(500);
  });
});
