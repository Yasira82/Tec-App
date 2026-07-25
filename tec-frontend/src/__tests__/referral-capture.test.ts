import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  captureRef, getPendingRef, clearPendingRef, applyReferral, REF_KEY,
} from '@/lib-client/referral';

describe('referral capture helpers', () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.cookie = `${REF_KEY}=; path=/; max-age=0`;
  });

  describe('captureRef', () => {
    it('captures + normalizes a ?ref= into sessionStorage and cookie', () => {
      const code = captureRef('?ref=abcd2345&x=1');
      expect(code).toBe('ABCD2345');
      expect(sessionStorage.getItem(REF_KEY)).toBe('ABCD2345');
      expect(document.cookie).toContain(`${REF_KEY}=ABCD2345`);
    });

    it('ignores a missing or malformed ref', () => {
      expect(captureRef('?foo=bar')).toBe('');
      expect(captureRef('?ref=' + encodeURIComponent('bad code!'))).toBe('');
      expect(getPendingRef()).toBe('');
    });
  });

  describe('getPendingRef', () => {
    it('reads from sessionStorage first', () => {
      sessionStorage.setItem(REF_KEY, 'FROMSESS');
      expect(getPendingRef()).toBe('FROMSESS');
    });

    it('falls back to the cookie when sessionStorage is empty', () => {
      document.cookie = `${REF_KEY}=FROMCOOK; path=/`;
      expect(getPendingRef()).toBe('FROMCOOK');
    });
  });

  describe('clearPendingRef', () => {
    it('removes the code from both stores', () => {
      captureRef('?ref=WIPEME12');
      clearPendingRef();
      expect(getPendingRef()).toBe('');
    });
  });

  describe('applyReferral', () => {
    afterEach(() => vi.restoreAllMocks());

    it('returns "applied" on a 2xx', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200 } as Response);
      expect(await applyReferral('ABCD2345')).toBe('applied');
    });

    it('returns "consumed" on a 4xx (already referred / own / past window)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 409 } as Response);
      expect(await applyReferral('ABCD2345')).toBe('consumed');
    });

    it('returns "retry" on a 5xx or network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 503 } as Response);
      expect(await applyReferral('ABCD2345')).toBe('retry');
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
      expect(await applyReferral('ABCD2345')).toBe('retry');
    });

    it('short-circuits an empty/invalid code as "consumed"', async () => {
      const spy = vi.spyOn(globalThis, 'fetch');
      expect(await applyReferral('')).toBe('consumed');
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
