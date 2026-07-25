import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import type { NextRequest } from 'next/server';

const GATEWAY = 'https://test-gateway.example.com';

// NextRequest.cookies.get() needs Next internals unavailable in happy-dom —
// mock only what the handler calls. `body` feeds req.json().
const makeRequest = (opts: { token?: string; body?: unknown } = {}): NextRequest => ({
  cookies: {
    get: (name: string) =>
      name === 'tec_access_token' && opts.token ? { name, value: opts.token } : undefined,
  },
  headers: { get: (n: string) => (n === 'authorization' ? null : null) },
  json: async () => opts.body ?? {},
} as unknown as NextRequest);

type Fn = (req: NextRequest) => Promise<Response>;

describe('/api/referral BFF', () => {
  let GET: Fn;
  let POST: Fn;

  beforeAll(async () => {
    process.env.API_GATEWAY_URL   = GATEWAY;
    // Force the real gateway path (not the E2E short-circuit) even under CI.
    process.env.E2E_ALLOW_NETWORK = 'true';
    delete process.env.E2E_MODE;
    delete process.env.NEXT_PUBLIC_E2E_MODE;
    vi.resetModules();
    ({ GET, POST } = await import('@/app/api/referral/route'));
  });

  afterAll(() => {
    vi.restoreAllMocks();
    delete process.env.API_GATEWAY_URL;
    delete process.env.E2E_ALLOW_NETWORK;
  });

  beforeEach(() => vi.restoreAllMocks());

  // ── GET ──────────────────────────────────────────────
  describe('GET', () => {
    it('401 without a token cookie', async () => {
      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
    });

    it('forwards the cookie as a Bearer and returns gateway data', async () => {
      const referral = { code: 'ABCD2345', stats: { pending: 1, rewarded: 2, total: 3 } };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, status: 200, json: async () => ({ success: true, data: { referral } }),
      } as unknown as Response);

      const res  = await GET(makeRequest({ token: 'tok-123' }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.referral.code).toBe('ABCD2345');
      const [url, opts] = fetchSpy.mock.calls[0];
      expect(String(url)).toContain('/api/commerce/referral/me');
      expect((opts?.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
    });

    it('503 when the gateway is unreachable', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
      const res = await GET(makeRequest({ token: 'tok' }));
      expect(res.status).toBe(503);
    });
  });

  // ── POST ─────────────────────────────────────────────
  describe('POST', () => {
    it('401 without a token cookie', async () => {
      const res = await POST(makeRequest({ body: { code: 'ABCD2345' } }));
      expect(res.status).toBe(401);
    });

    it('400 when no code is supplied', async () => {
      const res = await POST(makeRequest({ token: 'tok', body: {} }));
      expect(res.status).toBe(400);
    });

    it('forwards the code to the gateway and returns its response', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ success: true, data: { referral: { status: 'PENDING', code: 'ABCD2345' } } }),
      } as unknown as Response);

      const res  = await POST(makeRequest({ token: 'tok', body: { code: 'abcd2345' } }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.referral.status).toBe('PENDING');
      const [url, opts] = fetchSpy.mock.calls[0];
      expect(String(url)).toContain('/api/commerce/referral/attribute');
      expect(opts?.method).toBe('POST');
      // the client-trimmed code is forwarded
      expect(JSON.parse(opts?.body as string)).toEqual({ code: 'abcd2345' });
    });

    it('propagates a gateway rejection status (e.g. 409 already referred)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false, status: 409, json: async () => ({ error: 'You have already been referred' }),
      } as unknown as Response);
      const res = await POST(makeRequest({ token: 'tok', body: { code: 'ABCD2345' } }));
      expect(res.status).toBe(409);
    });
  });
});
