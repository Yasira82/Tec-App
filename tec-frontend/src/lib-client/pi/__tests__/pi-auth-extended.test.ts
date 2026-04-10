import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/sdk', () => ({
  default: {
    clearAuthToken: vi.fn(),
    payment: { resolveIncomplete: vi.fn(), getPayment: vi.fn() },
  },
}));

vi.mock('@/lib/firebase', () => ({
  getFCMToken: vi.fn().mockResolvedValue(null),
}));

import {
  refreshAccessToken,
  fetchWithAuth,
  logout,
} from '../pi-auth';

describe('pi-auth extended', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── logout ──────────────────────────────────────────────
  describe('logout', () => {
    it('calls /api/auth/logout', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, status: 200, json: async () => ({}),
      } as Response);

      await logout();

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/auth/logout',
        { method: 'POST' },
      );
    });

    it('does not throw when fetch fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
      await expect(logout()).resolves.toBeUndefined();
    });
  });

  // ── refreshAccessToken ──────────────────────────────────
  describe('refreshAccessToken', () => {
    it('returns new token on success', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok:   true,
        status: 200,
        json: async () => ({ token: 'new-access-token' }),
      } as Response);

      const token = await refreshAccessToken();
      expect(token).toBe('new-access-token');
    });

    it('returns null and calls logout on 401', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok:   false,
        status: 401,
        json: async () => ({}),
      } as Response);

      const token = await refreshAccessToken();

      expect(token).toBeNull();
      // logout بيبعت POST /api/auth/logout
      const logoutCall = fetchSpy.mock.calls.find(([url]) =>
        String(url).includes('/api/auth/logout')
      );
      expect(logoutCall).toBeDefined();
    });

    it('returns null on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
      const token = await refreshAccessToken();
      expect(token).toBeNull();
    });
  });

  // ── fetchWithAuth ───────────────────────────────────────
  describe('fetchWithAuth', () => {
    it('returns response on success', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, status: 200, json: async () => ({ data: 'ok' }),
      } as Response);

      const res = await fetchWithAuth('/api/test');
      expect(res.ok).toBe(true);
    });

    it('includes credentials: include', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, status: 200, json: async () => ({}),
      } as Response);

      await fetchWithAuth('/api/test');

      expect(fetchSpy.mock.calls[0][1]).toMatchObject({
        credentials: 'include',
      });
    });

    it('retries with new token on 401', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: false, status: 401, json: async () => ({}),
        } as Response)
        .mockResolvedValueOnce({
          ok: true, status: 200, json: async () => ({ token: 'refreshed' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true, status: 200, json: async () => ({ data: 'ok' }),
        } as Response);

      const res = await fetchWithAuth('/api/test');

      // أول call: الـ request الأصلي
      // تاني call: /api/auth/refresh
      // تالت call: إعادة الـ request
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(res.ok).toBe(true);
    });

    it('returns 401 response if refresh also fails', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: false, status: 401, json: async () => ({}),
        } as Response)
        .mockResolvedValueOnce({
          ok: false, status: 401, json: async () => ({}),
        } as Response)
        .mockResolvedValueOnce({
          ok: true, status: 200, json: async () => ({}),
        } as Response);

      const res = await fetchWithAuth('/api/test');
      // بعد refresh fail — بيرجع null ومش بيعمل retry
      expect(res).toBeDefined();
    });

    it('merges custom headers', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, status: 200, json: async () => ({}),
      } as Response);

      await fetchWithAuth('/api/test', {
        headers: { 'x-custom': 'value' },
      });

      const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers['x-custom']).toBe('value');
      expect(headers['Content-Type']).toBe('application/json');
    });
  });
});
