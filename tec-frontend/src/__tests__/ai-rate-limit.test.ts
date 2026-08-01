import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkRateLimit, __resetMemRateLimit, RATE_LIMIT } from '@/lib/ai/rate-limit';

describe('AI rate limiter', () => {
  beforeEach(() => {
    __resetMemRateLimit();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.restoreAllMocks();
  });
  afterEach(() => vi.restoreAllMocks());

  describe('in-memory fallback (no Upstash configured)', () => {
    it('allows exactly RATE_LIMIT requests, then blocks', async () => {
      let last;
      for (let i = 0; i < RATE_LIMIT; i++) last = await checkRateLimit('user-a');
      expect(last!.ok).toBe(true);
      expect(last!.remaining).toBe(0);
      const blocked = await checkRateLimit('user-a');
      expect(blocked.ok).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it('isolates windows per key', async () => {
      for (let i = 0; i < RATE_LIMIT; i++) await checkRateLimit('user-a');
      const other = await checkRateLimit('user-b');   // different user — fresh window
      expect(other.ok).toBe(true);
      expect(other.remaining).toBe(RATE_LIMIT - 1);
    });
  });

  describe('durable backend (Upstash REST configured)', () => {
    beforeEach(() => {
      process.env.UPSTASH_REDIS_REST_URL   = 'https://redis.example';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';
    });

    it('uses the pipeline INCR count as the verdict', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValue({ ok: true, json: async () => [{ result: 3 }, { result: 1 }] } as any);
      const r = await checkRateLimit('user-x');
      expect(r.ok).toBe(true);
      expect(r.remaining).toBe(RATE_LIMIT - 3);
      expect(fetchMock).toHaveBeenCalledWith('https://redis.example/pipeline', expect.objectContaining({ method: 'POST' }));
    });

    it('blocks once the durable count exceeds the limit', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValue({ ok: true, json: async () => [{ result: RATE_LIMIT + 1 }, { result: 0 }] } as any);
      const r = await checkRateLimit('user-x');
      expect(r.ok).toBe(false);
      expect(r.remaining).toBe(0);
    });

    it('fails OPEN to in-memory when the durable backend errors', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
      const r = await checkRateLimit('user-y');   // durable null → in-memory first hit
      expect(r.ok).toBe(true);
      expect(r.remaining).toBe(RATE_LIMIT - 1);
    });
  });
});
