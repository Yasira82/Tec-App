import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';

const GATEWAY = 'https://test-gateway.example.com';

type GETHandler = (req: NextRequest) => Promise<Response>;

const makeRequest = (hasCookie = true) =>
  new NextRequest('https://hub.tecosystem.app/api/bff/metrics', {
    headers: hasCookie ? { Cookie: 'tec_access_token=test-token-xyz' } : {},
  });

const NOW_MS = new Date('2026-06-04T12:00:00.000Z').getTime();
const makePayment = (status: string, hoursAgo: number, amount: number = 1) => ({
  status,
  createdAt: new Date(NOW_MS - hoursAgo * 3_600_000).toISOString(),
  amount,
});

describe('GET /api/bff/metrics', () => {
  let GET: GETHandler;

  beforeAll(async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS);
    process.env.API_GATEWAY_URL = GATEWAY;
    vi.resetModules();
    ({ GET } = await import('@/app/api/bff/metrics/route'));
  });

  afterAll(() => {
    vi.restoreAllMocks();
    delete process.env.API_GATEWAY_URL;
  });

  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok:   true,
      json: async () => ({ payments: [] }),
    } as unknown as Response);
  });

  // ── auth ─────────────────────────────────────────────────
  describe('authentication', () => {
    it('returns 401 when tec_access_token cookie is absent', async () => {
      const res  = await GET(makeRequest(false));
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('forwards token as Authorization: Bearer to gateway', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, json: async () => ({ payments: [] }),
      } as unknown as Response);
      await GET(makeRequest());
      const [, options] = fetchSpy.mock.calls[0];
      const auth = (options?.headers as Record<string, string>).Authorization;
      expect(auth).toBe('Bearer test-token-xyz');
    });
  });

  // ── gateway errors ───────────────────────────────────────
  describe('gateway error handling', () => {
    it('returns 502 when gateway responds with non-ok status', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false, status: 503, json: async () => ({}),
      } as unknown as Response);
      const res = await GET(makeRequest());
      expect(res.status).toBe(502);
    });

    it('returns 502 with error detail on network failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network timeout'));
      const res  = await GET(makeRequest());
      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.error).toBe('Metrics unavailable');
      expect(body.detail).toContain('Network timeout');
    });

    it('sends x-internal-key header to gateway', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, json: async () => ({ payments: [] }),
      } as unknown as Response);
      process.env.INTERNAL_SECRET = 'test-secret-key';
      await GET(makeRequest());
      const [, options] = fetchSpy.mock.calls[0];
      expect((options?.headers as Record<string, string>)['x-internal-key']).toBe('test-secret-key');
      delete process.env.INTERNAL_SECRET;
    });
  });

  // ── metric calculation ───────────────────────────────────
  describe('metric calculation', () => {
    it('returns healthy: true and successRate: null when no payments', async () => {
      const res  = await GET(makeRequest());
      const body = await res.json();
      expect(body.successRate).toBeNull();
      expect(body.healthy).toBe(true);
      expect(body.total).toBe(0);
    });

    it('counts completed, failed, cancelled, pending correctly', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok:   true,
        json: async () => ({
          payments: [
            makePayment('completed', 1),
            makePayment('completed', 2),
            makePayment('failed',    3),
            makePayment('cancelled', 4),
            makePayment('pending',   5),
          ],
        }),
      } as unknown as Response);
      const res  = await GET(makeRequest());
      const body = await res.json();
      expect(body.total).toBe(5);
      expect(body.completed).toBe(2);
      expect(body.failed).toBe(1);
      expect(body.cancelled).toBe(1);
      expect(body.pending).toBe(1);
    });

    it('filters out payments older than 24 hours', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok:   true,
        json: async () => ({
          payments: [
            makePayment('completed', 1),   // within 24h — included
            makePayment('completed', 25),  // 25h ago — excluded
          ],
        }),
      } as unknown as Response);
      const res  = await GET(makeRequest());
      const body = await res.json();
      expect(body.total).toBe(1);
      expect(body.completed).toBe(1);
    });

    it('calculates successRate as integer percentage', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok:   true,
        json: async () => ({
          payments: [
            makePayment('completed', 1),
            makePayment('completed', 2),
            makePayment('completed', 3),
            makePayment('failed',    4),
          ],
        }),
      } as unknown as Response);
      const res  = await GET(makeRequest());
      const body = await res.json();
      expect(body.successRate).toBe(75);
    });

    it('marks healthy: false when successRate < 80', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok:   true,
        json: async () => ({
          payments: [
            makePayment('completed', 1),
            makePayment('failed',    2),
            makePayment('failed',    3),
            makePayment('failed',    4),
          ],
        }),
      } as unknown as Response);
      const res  = await GET(makeRequest());
      const body = await res.json();
      expect(body.successRate).toBe(25);
      expect(body.healthy).toBe(false);
    });

    it('marks healthy: true when successRate >= 80', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok:   true,
        json: async () => ({
          payments: [
            makePayment('completed', 1),
            makePayment('completed', 2),
            makePayment('completed', 3),
            makePayment('completed', 4),
            makePayment('failed',    5),
          ],
        }),
      } as unknown as Response);
      const res  = await GET(makeRequest());
      const body = await res.json();
      expect(body.successRate).toBe(80);
      expect(body.healthy).toBe(true);
    });

    it('sums volume from completed payments only', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok:   true,
        json: async () => ({
          payments: [
            makePayment('completed', 1, 5),
            makePayment('completed', 2, 3.5),
            makePayment('failed',    3, 100),
          ],
        }),
      } as unknown as Response);
      const res  = await GET(makeRequest());
      const body = await res.json();
      expect(body.volume).toBe(8.5);
    });

    it('handles data.data.payments response envelope', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok:   true,
        json: async () => ({ data: { payments: [makePayment('completed', 1)] } }),
      } as unknown as Response);
      const res  = await GET(makeRequest());
      const body = await res.json();
      expect(body.total).toBe(1);
    });
  });

  // ── response shape ────────────────────────────────────────
  describe('response shape', () => {
    it('includes all required fields', async () => {
      const res  = await GET(makeRequest());
      const body = await res.json();
      expect(body).toMatchObject({
        window:      '24h',
        total:       expect.any(Number),
        completed:   expect.any(Number),
        failed:      expect.any(Number),
        cancelled:   expect.any(Number),
        pending:     expect.any(Number),
        volume:      expect.any(Number),
        healthy:     expect.any(Boolean),
        generatedAt: expect.any(String),
      });
    });
  });
});
