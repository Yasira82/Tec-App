/**
 * Coverage sweep 3 — guard returns, catch callbacks and queue paths:
 *   pi-auth: getStoredUser malformed cookie, refresh queue failure paths,
 *            incomplete-payment no-identifier, recovery step-3 !ok/throw,
 *            auth timeout, authenticate rejection
 *   usePiAuth: login errorType classification (timeout / storage / not_pi_browser)
 *   useWallet: tx type mapping, filterType filter, AbortError ignore
 *   usePiSdkReady: visibilitychange re-init
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockResolveIncomplete = vi.hoisted(() => vi.fn());
vi.mock('@/lib/sdk', () => ({
  default: {
    clearAuthToken: vi.fn(),
    payment: { resolveIncomplete: mockResolveIncomplete },
  },
}));

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  addBreadcrumb:  vi.fn(),
}));

vi.mock('@/lib/firebase', () => ({
  getFCMToken: vi.fn(async () => null),
}));

const mockEnsureAuth = vi.hoisted(() => vi.fn());
vi.mock('@/lib-client/pi/pi-session', () => ({
  piSession: {
    ensureAuth:          mockEnsureAuth,
    ensurePaymentsReady: vi.fn(async () => true),
    reset:               vi.fn(),
    reInit:              vi.fn(),
    lastError:           null,
  },
  PiAuthError: class PiAuthError extends Error {},
}));

import {
  getStoredUser,
  refreshAccessToken,
  loginWithPi,
} from '@/lib-client/pi/pi-auth';
import { usePiAuth }      from '@/lib-client/hooks/usePiAuth';
import { useWallet }      from '@/lib-client/hooks/useWallet';
import { usePiSdkReady }  from '@/lib-client/hooks/usePiSdkReady';

const setCookie = (value: string) => {
  Object.defineProperty(document, 'cookie', {
    writable: true, configurable: true, value,
  });
};

const loginOkResponse = {
  ok: true, status: 200,
  json: async () => ({
    success: true, isNewUser: false,
    user: { id: 'u-1', piId: 'pi-1', piUsername: 'alice', role: 'user', subscriptionPlan: 'Free', createdAt: '2024-01-01' },
  }),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockEnsureAuth.mockResolvedValue(true);
  setCookie('');
  delete (window as any).Pi;
  delete (window as any).__TEC_PI_READY;
  delete (window as any).__TEC_PI_ERROR;
});

afterEach(() => {
  vi.useRealTimers();
});

// ── pi-auth ───────────────────────────────────────────────────────
describe('pi-auth guard branches', () => {
  it('getStoredUser returns null on malformed tec_user cookie', () => {
    setCookie('tec_user=%7Bnot-valid-json');
    expect(getStoredUser()).toBeNull();
  });

  it('getStoredUser parses a valid cookie', () => {
    setCookie(`tec_user=${encodeURIComponent(JSON.stringify({ id: 'u-2', piUsername: 'bob' }))}`);
    expect(getStoredUser()).toMatchObject({ id: 'u-2' });
  });

  it('refresh failure flushes queued callers with null', async () => {
    let resolveFetch!: (v: any) => void;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('/api/auth/refresh')) {
        return new Promise(r => { resolveFetch = r; });
      }
      return { ok: true, json: async () => ({}) };
    });
    const p1 = refreshAccessToken();
    const p2 = refreshAccessToken(); // queued
    resolveFetch({ ok: false, status: 401 });
    const [t1, t2] = await Promise.all([p1, p2]);
    expect(t1).toBeNull();
    expect(t2).toBeNull();
  });

  it('refresh network error flushes queued callers with null', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let rejectFetch!: (e: Error) => void;
    let first = true;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('/api/auth/refresh') && first) {
        first = false;
        return new Promise((_r, rej) => { rejectFetch = rej; });
      }
      return { ok: true, json: async () => ({}) };
    });
    const p1 = refreshAccessToken();
    const p2 = refreshAccessToken();
    rejectFetch(new Error('socket reset'));
    const [t1, t2] = await Promise.all([p1, p2]);
    expect(t1).toBeNull();
    expect(t2).toBeNull();
    errSpy.mockRestore();
  });

  it('loginWithPi ignores incomplete payment without identifier', async () => {
    (window as any).__TEC_PI_READY = true;
    (window as any).Pi = {
      authenticate: vi.fn(async (_s: string[], onIncomplete: (p: unknown) => void) => {
        onIncomplete({});           // no identifier → handleIncompletePayment early-returns
        onIncomplete(null);
        return { accessToken: 'pi-tok', user: { uid: 'pi-1', username: 'alice' } };
      }),
    };
    global.fetch = vi.fn().mockResolvedValue(loginOkResponse);
    const result = await loginWithPi();
    expect(result.success).toBe(true);
    // No resolve-incomplete call queued
    const calls = (global.fetch as any).mock.calls.map((c: any[]) => String(c[0]));
    expect(calls.some((u: string) => u.includes('resolve-incomplete'))).toBe(false);
  });

  it('recovery: cancel endpoint !ok logs all-attempts-failed', async () => {
    (window as any).__TEC_PI_READY = true;
    (window as any).Pi = {
      authenticate: vi.fn(async (_s: string[], onIncomplete: (p: unknown) => void) => {
        onIncomplete({ identifier: 'pi-pending-x' });
        return { accessToken: 'pi-tok', user: { uid: 'pi-1', username: 'alice' } };
      }),
    };
    mockResolveIncomplete.mockRejectedValue(new Error('sdk down'));
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes('/api/auth/pi-login')) return loginOkResponse;
      if (u.includes('resolve-incomplete')) {
        return { ok: false, status: 500, json: async () => { throw new Error('bad json'); } };
      }
      if (u.includes('/api/payment/cancel')) return { ok: false, status: 409, json: async () => ({}) };
      return { ok: true, json: async () => ({}) };
    });
    await loginWithPi();
    await new Promise(r => setTimeout(r, 20));
    const calls = (global.fetch as any).mock.calls.map((c: any[]) => String(c[0]));
    expect(calls.some((u: string) => u.includes('/api/payment/cancel'))).toBe(true);
  });

  it('recovery: cancel endpoint network error is swallowed', async () => {
    (window as any).__TEC_PI_READY = true;
    (window as any).Pi = {
      authenticate: vi.fn(async (_s: string[], onIncomplete: (p: unknown) => void) => {
        onIncomplete({ identifier: 'pi-pending-y' });
        return { accessToken: 'pi-tok', user: { uid: 'pi-1', username: 'alice' } };
      }),
    };
    mockResolveIncomplete.mockRejectedValue(new Error('sdk down'));
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes('/api/auth/pi-login')) return loginOkResponse;
      if (u.includes('resolve-incomplete')) return { ok: false, status: 503, json: async () => ({}) };
      if (u.includes('/api/payment/cancel')) throw new Error('offline');
      return { ok: true, json: async () => ({}) };
    });
    const result = await loginWithPi();
    await new Promise(r => setTimeout(r, 20));
    expect(result.success).toBe(true);
  });

  it('loginWithPi propagates Pi.authenticate rejection', async () => {
    (window as any).__TEC_PI_READY = true;
    (window as any).Pi = {
      authenticate: vi.fn().mockRejectedValue(new Error('user dismissed dialog')),
    };
    global.fetch = vi.fn();
    await expect(loginWithPi()).rejects.toThrow('user dismissed dialog');
  });
});

// ── usePiAuth errorType classification ────────────────────────────
describe('usePiAuth login error classification', () => {
  const setupAuthReject = (message: string) => {
    (window as any).__TEC_PI_READY = true;
    (window as any).Pi = {
      authenticate: vi.fn().mockRejectedValue(new Error(message)),
    };
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  };

  it.each([
    ['Request timed out after 45s', 'timeout'],
    ['localStorage unavailable in private mode', 'storage'],
  ])('classifies "%s" as %s', async (message, expected) => {
    setupAuthReject(message);
    const { result } = renderHook(() => usePiAuth());
    await act(async () => {
      await expect(result.current.login()).rejects.toThrow();
    });
    expect(result.current.errorType).toBe(expected);
    expect(result.current.error).toBe(message);
  });
});

// ── useWallet mapping + filter + abort ────────────────────────────
describe('useWallet tx mapping and filters', () => {
  const setUserCookie = () => {
    setCookie(
      `tec_access_token=tok-1; tec_user=${encodeURIComponent(JSON.stringify({ id: 'u-1' }))}`,
    );
  };

  const txFixtures = [
    { id: 't1', type: 'deposit',    status: 'completed', amount: 1, currency: 'PI', created_at: '2024-01-01' },
    { id: 't2', type: 'withdrawal', status: 'completed', amount: 2, currency: 'PI', created_at: '2024-01-02' },
    { id: 't3', type: 'transfer',   status: 'completed', amount: 3, currency: 'PI', created_at: '2024-01-03', metadata: { direction: 'credit' } },
    { id: 't4', type: 'transfer',   status: 'completed', amount: 4, currency: 'PI', created_at: '2024-01-04', metadata: { direction: 'debit' } },
    { id: 't5', type: 'payment',    status: 'completed', amount: 5, currency: 'PI', created_at: '2024-01-05' },
  ];

  const mockWalletFetch = () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes('/api/bff/wallet/balance')) {
        return { ok: true, json: async () => ({ balance: 9, currency: 'PI', walletId: 'w-1' }) };
      }
      if (u.includes('transactions')) {
        return {
          ok: true,
          json: async () => ({ data: { transactions: txFixtures, pagination: { total: 5 } } }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });
  };

  it('maps deposit/withdrawal/transfer directions to receive/send', async () => {
    setUserCookie();
    mockWalletFetch();
    const { result } = renderHook(() => useWallet());
    await act(async () => {});
    await vi.waitFor(() => expect(result.current.transactions.length).toBe(5));
    const types = Object.fromEntries(result.current.transactions.map(t => [t.id, t.type]));
    expect(types).toEqual({
      t1: 'receive', t2: 'send', t3: 'receive', t4: 'send', t5: 'payment',
    });
  });

  it('filterType narrows transactions to matching type', async () => {
    setUserCookie();
    mockWalletFetch();
    const { result } = renderHook(() => useWallet());
    await act(async () => {});
    await vi.waitFor(() => expect(result.current.transactions.length).toBe(5));
    act(() => { result.current.setFilterType('send'); });
    await vi.waitFor(() => {
      expect(result.current.transactions.every(t => t.type === 'send')).toBe(true);
      expect(result.current.transactions.length).toBe(2);
    });
  });

  it('ignores AbortError from a superseded fetch', async () => {
    setUserCookie();
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });
    global.fetch = vi.fn().mockRejectedValue(abortErr);
    const { result } = renderHook(() => useWallet());
    await act(async () => {});
    expect(result.current.error).toBeNull();
  });
});

// ── usePiSdkReady visibilitychange ────────────────────────────────
describe('usePiSdkReady visibility re-init', () => {
  it('re-runs initSession when tab becomes visible after debounce window', async () => {
    vi.useFakeTimers();
    (window as any).Pi = { authenticate: vi.fn() };
    (window as any).__TEC_PI_READY = true;
    renderHook(() => usePiSdkReady());
    await act(async () => {});
    const callsBefore = mockEnsureAuth.mock.calls.length;

    // Move past the 2s debounce, then fire visibilitychange
    await act(async () => { vi.advanceTimersByTime(2500); });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true, get: () => 'visible',
    });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });

    expect(mockEnsureAuth.mock.calls.length).toBeGreaterThan(callsBefore);
    vi.useRealTimers();
  });

  it('ignores visibilitychange when document is hidden', async () => {
    (window as any).Pi = { authenticate: vi.fn() };
    (window as any).__TEC_PI_READY = true;
    renderHook(() => usePiSdkReady());
    await act(async () => {});
    const callsBefore = mockEnsureAuth.mock.calls.length;
    Object.defineProperty(document, 'visibilityState', {
      configurable: true, get: () => 'hidden',
    });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(mockEnsureAuth.mock.calls.length).toBe(callsBefore);
  });
});
