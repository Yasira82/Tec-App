/**
 * Batch tests for remaining API routes:
 *   auth/logout-from-sso, auth/refresh,
 *   analytics, health, health/services,
 *   kyc/start, kyc/status, kyc/submit, kyc/upload,
 *   assets, assets/buy
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── jose mock ─────────────────────────────────────────────────────
vi.mock('jose', () => ({
  jwtVerify: vi.fn().mockResolvedValue({ payload: { sub: 'user-123' }, protectedHeader: {} }),
}));

// ── helpers ───────────────────────────────────────────────────────
function req(opts: {
  method?:   string;
  url?:      string;
  search?:   string;
  cookies?:  Record<string, string>;
  headers?:  Record<string, string | null>;
  body?:     unknown;
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
      get: (name: string) => (opts.headers ?? {})[name] ?? null,
    },
    json: async () => opts.body ?? {},
  } as unknown as NextRequest;
}

const okRes   = (data = {}, status = 200) =>
  Promise.resolve({ ok: true, status, json: async () => data } as Response);
const failRes = (status = 503, data = {}) =>
  Promise.resolve({ ok: false, status, json: async () => data } as Response);

beforeEach(() => {
  process.env.API_GATEWAY_URL  = 'https://gw.test';
  process.env.JWT_SECRET       = 'jwt-secret-32-chars-long-xxxxxxx';
  process.env.INTERNAL_SECRET  = 'int-secret';
  vi.clearAllMocks();
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => okRes());
});

// ═══════════════════════════════════════════════════════════════
// auth/logout-from-sso
// ═══════════════════════════════════════════════════════════════
describe('GET /api/auth/logout-from-sso', () => {
  it('redirects to / and clears auth cookies', async () => {
    const { GET } = await import('@/app/api/auth/logout-from-sso/route');
    const res = await GET(req({}));
    expect(res.status).toBe(307);
    const cleared = res.cookies.getAll().map((c: { name: string }) => c.name);
    expect(cleared).toContain('tec_access_token');
    expect(cleared).toContain('tec_user');
    expect(cleared).toContain('tec_csrf');
  });
});

// ═══════════════════════════════════════════════════════════════
// auth/refresh
// ═══════════════════════════════════════════════════════════════
describe('POST /api/auth/refresh', () => {
  it('returns 401 if no refresh token cookie', async () => {
    const { POST } = await import('@/app/api/auth/refresh/route');
    const res = await POST(req({ method: 'POST', cookies: {} }));
    expect(res.status).toBe(401);
  });

  it('returns gateway error response on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(failRes(401, { error: 'invalid_token' }));
    const { POST } = await import('@/app/api/auth/refresh/route');
    const res = await POST(req({ method: 'POST', cookies: { tec_refresh_token: 'old-tok' } }));
    expect(res.status).toBe(401);
  });

  it('returns 502 if gateway returns no access token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ data: {} }),
    } as Response);
    const { POST } = await import('@/app/api/auth/refresh/route');
    const res = await POST(req({ method: 'POST', cookies: { tec_refresh_token: 'old-tok' } }));
    expect(res.status).toBe(502);
  });

  it('sets cookies and returns new token on success (data.token)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ token: 'new-access-tok', refreshToken: 'new-refresh' }),
    } as Response);
    const { POST } = await import('@/app/api/auth/refresh/route');
    const res = await POST(req({ method: 'POST', cookies: { tec_refresh_token: 'old-tok' } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBe('new-access-tok');
    const cookieNames = res.cookies.getAll().map((c: { name: string }) => c.name);
    expect(cookieNames).toContain('tec_access_token');
    expect(cookieNames).toContain('tec_csrf');
    expect(cookieNames).toContain('tec_refresh_token');
  });

  it('sets cookies without new refresh token (no refreshToken in response)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ accessToken: 'new-access-tok' }),
    } as Response);
    const { POST } = await import('@/app/api/auth/refresh/route');
    const res = await POST(req({ method: 'POST', cookies: { tec_refresh_token: 'old-tok' } }));
    expect(res.status).toBe(200);
  });

  it('returns 502 and NAMES the hop when the gateway cannot be reached', async () => {
    // Was 500. A 500 says "this route broke"; the route did not break — the
    // gateway did not answer, which is a 502, and the caller now gets told
    // which hop died instead of a bare "Internal Server Error".
    //
    // The change that matters more is not visible in the status: this branch
    // is only REACHABLE because the fetch is now bounded. Unbounded, a gateway
    // that stalls (rather than refusing) never rejects at all — the invocation
    // is killed by the platform and this handler never runs.
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const { POST } = await import('@/app/api/auth/refresh/route');
    const res = await POST(req({ method: 'POST', cookies: { tec_refresh_token: 'old-tok' } }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('gateway_unreachable');
    expect(body.reason).toContain('ECONNREFUSED');
  });

  it('reports a TIMEOUT the same way — the stall is the case that mattered', async () => {
    // `AbortSignal.timeout` rejects with a TimeoutError. This is the shape the
    // production failure actually had: the gateway's own logs showed
    // `socket hang up` / `ECONNRESET` against the services it proxies, and a
    // stalled hop is what held the login handoff open until it was killed.
    const timeout = Object.assign(new Error('The operation was aborted due to timeout'), {
      name: 'TimeoutError',
    });
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(timeout);
    const { POST } = await import('@/app/api/auth/refresh/route');
    const res = await POST(req({ method: 'POST', cookies: { tec_refresh_token: 'old-tok' } }));
    expect(res.status).toBe(502);
    expect((await res.json()).reason).toContain('TimeoutError');
  });
});

// ═══════════════════════════════════════════════════════════════
// analytics
// ═══════════════════════════════════════════════════════════════
describe('GET /api/analytics', () => {
  it('returns 400 for invalid endpoint', async () => {
    const { GET } = await import('@/app/api/analytics/route');
    const r = req({ search: '?endpoint=evil_endpoint' });
    const res = await GET(r);
    expect(res.status).toBe(400);
  });

  it('returns data for valid endpoint (overview)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(okRes({ metrics: {} }));
    const { GET } = await import('@/app/api/analytics/route');
    const r = req({ search: '?endpoint=overview' });
    const res = await GET(r);
    expect(res.status).toBe(200);
  });

  it('returns data for payments endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(okRes({ payments: [] }));
    const { GET } = await import('@/app/api/analytics/route');
    const r = req({ search: '?endpoint=payments', headers: { authorization: 'Bearer tok' } });
    const res = await GET(r);
    expect(res.status).toBe(200);
  });

  it('returns 503 on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));
    const { GET } = await import('@/app/api/analytics/route');
    const r = req({ search: '?endpoint=overview' });
    const res = await GET(r);
    expect(res.status).toBe(503);
  });

  it('defaults to overview when no endpoint param', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(okRes({}));
    const { GET } = await import('@/app/api/analytics/route');
    await GET(req({}));
    expect(mockFetch.mock.calls[0][0] as string).toContain('overview');
  });
});

// ═══════════════════════════════════════════════════════════════
// health
// ═══════════════════════════════════════════════════════════════
describe('GET /api/health', () => {
  it('returns online:false if no gateway URL', async () => {
    delete process.env.API_GATEWAY_URL;
    const { GET } = await import('@/app/api/health/route');
    const res = await GET();
    const body = await res.json();
    expect(body.online).toBe(false);
    process.env.API_GATEWAY_URL = 'https://gw.test';
  });

  it('returns online:true when gateway responds OK', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(okRes({ status: 'ok' }));
    const { GET } = await import('@/app/api/health/route');
    const res = await GET();
    const body = await res.json();
    expect(body.online).toBe(true);
  });

  it('returns online:false when gateway returns non-ok status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(failRes(503));
    const { GET } = await import('@/app/api/health/route');
    const res = await GET();
    const body = await res.json();
    expect(body.online).toBe(false);
  });

  it('returns online:false on fetch error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('timeout'));
    const { GET } = await import('@/app/api/health/route');
    const res = await GET();
    const body = await res.json();
    expect(body.online).toBe(false);
    expect(body.error).toContain('timeout');
  });
});

// ═══════════════════════════════════════════════════════════════
// health/services
// ═══════════════════════════════════════════════════════════════
describe('GET /api/health/services', () => {
  // The per-service verdicts come from the gateway's /health/detailed (8 Nov 2026):
  // the old per-path checks hit /<svc>/health, which no service serves.
  const byUrl = (detailed: Promise<Response>) => (url: string | URL | Request) =>
    String(url).endsWith('/health/detailed') ? detailed : okRes({ status: 'ok' });

  it('returns 200 when the gateway and every service it checks are ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(byUrl(okRes({ dependencies: { payment: 'ok', life: 'ok' } })) as typeof fetch);
    const { GET } = await import('@/app/api/health/services/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.services.map((s: { name: string }) => s.name)).toEqual(['gateway', 'payment', 'life']);
  });

  it('asks /health/detailed with the internal key, never a public per-service path', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(byUrl(okRes({ dependencies: { kyc: 'ok' } })) as typeof fetch);
    const { GET } = await import('@/app/api/health/services/route');
    await GET();
    const urls = spy.mock.calls.map((c) => String(c[0]));
    expect(urls).toEqual(['https://gw.test/health', 'https://gw.test/health/detailed']);
    expect((spy.mock.calls[1][1] as RequestInit).headers).toEqual({ 'x-internal-key': 'int-secret' });
  });

  it('returns 207 and names the service when one is degraded (207 from the gateway)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(byUrl(failRes(207, { dependencies: { payment: 'degraded', kyc: 'ok' } })) as typeof fetch);
    const { GET } = await import('@/app/api/health/services/route');
    const res = await GET();
    expect(res.status).toBe(207);
    const body = await res.json();
    expect(body.services).toContainEqual(expect.objectContaining({ name: 'payment', status: 'error' }));
  });

  it('a refused or unreachable per-service check is an error, never silence (P6)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(byUrl(failRes(403)) as typeof fetch);
    const { GET } = await import('@/app/api/health/services/route');
    const res = await GET();
    expect(res.status).toBe(207);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.services.some((s: { status: string }) => s.status === 'error')).toBe(true);
  });

  it('handles the gateway being unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('timeout'));
    const { GET } = await import('@/app/api/health/services/route');
    const body = await (await GET()).json();
    expect(body.services.every((s: { status: string }) => s.status === 'error')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// kyc routes
// ═══════════════════════════════════════════════════════════════
describe('KYC routes', () => {
  describe('POST /api/kyc/start', () => {
    it('returns 401 if no token', async () => {
      const { POST } = await import('@/app/api/kyc/start/route');
      const res = await POST(req({ method: 'POST', cookies: {} }));
      expect(res.status).toBe(401);
    });

    it('returns gateway response on success', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(okRes({ data: { id: 'kyc-1' } }));
      const { POST } = await import('@/app/api/kyc/start/route');
      const res = await POST(req({ method: 'POST', cookies: { tec_access_token: 'tok' } }));
      expect(res.status).toBe(200);
    });

    it('returns 500 on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));
      const { POST } = await import('@/app/api/kyc/start/route');
      const res = await POST(req({ method: 'POST', cookies: { tec_access_token: 'tok' } }));
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/kyc/status', () => {
    it('returns 401 if no token', async () => {
      const { GET } = await import('@/app/api/kyc/status/route');
      const res = await GET(req({ cookies: {} }));
      expect(res.status).toBe(401);
    });

    it('returns KYC status from gateway', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        okRes({ data: { status: 'PENDING', level: 'L0' } })
      );
      const { GET } = await import('@/app/api/kyc/status/route');
      const res = await GET(req({ cookies: { tec_access_token: 'tok' } }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.status).toBe('PENDING');
    });

    it('returns 500 on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));
      const { GET } = await import('@/app/api/kyc/status/route');
      const res = await GET(req({ cookies: { tec_access_token: 'tok' } }));
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/kyc/submit', () => {
    it('returns 401 if no token', async () => {
      const { POST } = await import('@/app/api/kyc/submit/route');
      const res = await POST(req({ method: 'POST', cookies: {} }));
      expect(res.status).toBe(401);
    });

    it('submits to gateway and returns result', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(okRes({ data: { status: 'PENDING' } }));
      const { POST } = await import('@/app/api/kyc/submit/route');
      const res = await POST(req({ method: 'POST', cookies: { tec_access_token: 'tok' } }));
      expect(res.status).toBe(200);
    });

    it('returns 500 on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));
      const { POST } = await import('@/app/api/kyc/submit/route');
      const res = await POST(req({ method: 'POST', cookies: { tec_access_token: 'tok' } }));
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/kyc/upload', () => {
    it('returns 401 if no token', async () => {
      const { POST } = await import('@/app/api/kyc/upload/route');
      const res = await POST(req({ method: 'POST', cookies: {} }));
      expect(res.status).toBe(401);
    });

    it('uploads docs to gateway', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(okRes({ data: { uploaded: true } }));
      const { POST } = await import('@/app/api/kyc/upload/route');
      const res = await POST(req({
        method: 'POST',
        cookies: { tec_access_token: 'tok' },
        body: { idFrontUrl: 'https://example.com/id.jpg', selfieUrl: 'https://example.com/selfie.jpg' },
      }));
      expect(res.status).toBe(200);
    });

    it('returns 500 on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));
      const { POST } = await import('@/app/api/kyc/upload/route');
      const res = await POST(req({
        method: 'POST',
        cookies: { tec_access_token: 'tok' },
        body: { idFrontUrl: 'https://example.com/id.jpg' },
      }));
      expect(res.status).toBe(500);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// assets routes
// ═══════════════════════════════════════════════════════════════
describe('Assets routes', () => {
  describe('GET /api/assets', () => {
    it('returns 401 if no auth header', async () => {
      const { GET } = await import('@/app/api/assets/route');
      const res = await GET(req({}));
      expect(res.status).toBe(401);
    });

    it('returns assets from gateway', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(okRes({ data: [] }));
      const { GET } = await import('@/app/api/assets/route');
      const res = await GET(req({ headers: { authorization: 'Bearer tok' } }));
      expect(res.status).toBe(200);
    });

    it('returns user assets when userId param provided', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(okRes({ data: [] }));
      const { GET } = await import('@/app/api/assets/route');
      await GET(req({ headers: { authorization: 'Bearer tok' }, search: '?userId=u1' }));
      expect(mockFetch.mock.calls[0][0] as string).toContain('user/u1');
    });

    it('returns 503 on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));
      const { GET } = await import('@/app/api/assets/route');
      const res = await GET(req({ headers: { authorization: 'Bearer tok' } }));
      expect(res.status).toBe(503);
    });
  });

  describe('POST /api/assets (provision)', () => {
    it('returns 401 if no auth header', async () => {
      const { POST } = await import('@/app/api/assets/route');
      const res = await POST(req({ method: 'POST' }));
      expect(res.status).toBe(401);
    });

    it('provisions asset via gateway', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(okRes({ data: { id: 'asset-1' } }, 201));
      const { POST } = await import('@/app/api/assets/route');
      const res = await POST(req({
        method: 'POST',
        headers: { authorization: 'Bearer tok' },
        body: { name: 'My Asset', type: 'NFT' },
      }));
      expect(res.status).toBe(201);
    });

    it('returns 503 on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));
      const { POST } = await import('@/app/api/assets/route');
      const res = await POST(req({
        method: 'POST',
        headers: { authorization: 'Bearer tok' },
        body: {},
      }));
      expect(res.status).toBe(503);
    });
  });

  describe('POST /api/assets/buy', () => {
    it('returns 401 if no token cookie', async () => {
      const { POST } = await import('@/app/api/assets/buy/route');
      const res = await POST(req({ method: 'POST', cookies: {} }));
      expect(res.status).toBe(401);
    });

    it('returns 401 if jwt verify fails', async () => {
      const { jwtVerify } = await import('jose');
      vi.mocked(jwtVerify).mockRejectedValueOnce(new Error('invalid token'));
      const { POST } = await import('@/app/api/assets/buy/route');
      const res = await POST(req({ method: 'POST', cookies: { tec_access_token: 'bad-tok' } }));
      expect(res.status).toBe(401);
    });

    it('returns 400 if listing_id or payment_id missing', async () => {
      const { POST } = await import('@/app/api/assets/buy/route');
      const res = await POST(req({
        method: 'POST',
        cookies: { tec_access_token: 'valid-tok' },
        body: { listing_id: 'l1' },
      }));
      expect(res.status).toBe(400);
    });

    it('buys asset via gateway', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(okRes({ data: { txid: 'tx1' } }, 200));
      const { POST } = await import('@/app/api/assets/buy/route');
      const res = await POST(req({
        method: 'POST',
        cookies: { tec_access_token: 'valid-tok' },
        body: { listing_id: 'l1', payment_id: 'pay-1' },
      }));
      expect(res.status).toBe(200);
    });

    it('returns 401 if no sub in JWT payload', async () => {
      const { jwtVerify } = await import('jose');
      vi.mocked(jwtVerify).mockResolvedValueOnce({ payload: { sub: undefined }, protectedHeader: {} } as any);
      const { POST } = await import('@/app/api/assets/buy/route');
      const res = await POST(req({
        method: 'POST',
        cookies: { tec_access_token: 'valid-tok' },
        body: { listing_id: 'l1', payment_id: 'pay-1' },
      }));
      expect(res.status).toBe(401);
    });
  });
});
