import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────
vi.mock('@/lib/sdk', () => ({
  default: {
    clearAuthToken:   vi.fn(),
    payment: {
      resolveIncomplete: vi.fn(),
    },
  },
}));

vi.mock('@sentry/nextjs', () => ({
  captureMessage:  vi.fn(),
  addBreadcrumb:   vi.fn(),
}));

import {
  isPiBrowser,
  getAccessToken,
  getStoredUser,
  logout,
  refreshAccessToken,
  fetchWithAuth,
  waitForPiSDK,
  loginWithPi,
} from '@/lib-client/pi/pi-auth';

import sdk from '@/lib/sdk';

// ── Helpers ────────────────────────────────────────────────
const setCookie = (name: string, value: string) => {
  Object.defineProperty(document, 'cookie', {
    writable:     true,
    configurable: true,
    value:        `${name}=${value}`,
  });
};

const clearCookies = () => {
  Object.defineProperty(document, 'cookie', {
    writable:     true,
    configurable: true,
    value:        '',
  });
};

const mockFetch = (response: Partial<Response>) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok:     true,
    status: 200,
    json:   vi.fn().mockResolvedValue({}),
    ...response,
  } as Response);
};

// ══════════════════════════════════════════════════════════
describe('isPiBrowser', () => {
  it('returns false when window.Pi is undefined', () => {
    delete (window as Window & { Pi?: unknown }).Pi;
    expect(isPiBrowser()).toBe(false);
  });

  it('returns false when Pi.authenticate is not a function', () => {
    (window as Window & { Pi?: unknown }).Pi = { authenticate: 'not-a-function' };
    expect(isPiBrowser()).toBe(false);
  });

  it('returns true when window.Pi.authenticate is a function', () => {
    (window as Window & { Pi?: unknown }).Pi = { authenticate: vi.fn() };
    expect(isPiBrowser()).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
describe('getAccessToken', () => {
  afterEach(clearCookies);

  it('returns null when cookie is missing', () => {
    clearCookies();
    expect(getAccessToken()).toBeNull();
  });

  it('returns token from cookie', () => {
    setCookie('tec_access_token', 'my-token-123');
    expect(getAccessToken()).toBe('my-token-123');
  });
});

// ══════════════════════════════════════════════════════════
describe('getStoredUser', () => {
  afterEach(clearCookies);

  it('returns null when cookie is missing', () => {
    clearCookies();
    expect(getStoredUser()).toBeNull();
  });

  it('returns parsed user from cookie', () => {
    const user = { id: 'user-1', piUsername: 'yasser' };
    setCookie('tec_user', encodeURIComponent(JSON.stringify(user)));
    expect(getStoredUser()).toEqual(user);
  });

  it('returns null on invalid JSON', () => {
    setCookie('tec_user', 'invalid-json');
    expect(getStoredUser()).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════
describe('logout', () => {
  beforeEach(() => {
    mockFetch({ ok: true });
  });

  it('calls /api/auth/logout and clears SDK token', async () => {
    await logout();
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
    expect(sdk.clearAuthToken).toHaveBeenCalled();
  });

  it('does not throw on fetch failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    await expect(logout()).resolves.not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════
describe('refreshAccessToken', () => {
  beforeEach(() => {
    mockFetch({
      ok:   true,
      json: vi.fn().mockResolvedValue({ token: 'new-token-abc' }),
    });
  });

  it('returns new token on success', async () => {
    const token = await refreshAccessToken();
    expect(token).toBe('new-token-abc');
  });

  it('calls logout and returns null on 401', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok:     false,
      status: 401,
      json:   vi.fn().mockResolvedValue({}),
    });
    const token = await refreshAccessToken();
    expect(token).toBeNull();
  });

  it('calls logout and returns null on network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const token = await refreshAccessToken();
    expect(token).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════
describe('fetchWithAuth', () => {
  it('returns response directly on success', async () => {
    mockFetch({ ok: true, status: 200 });
    const res = await fetchWithAuth('/api/test');
    expect(res.status).toBe(200);
  });

  it('retries with new token on 401', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: vi.fn().mockResolvedValue({}) })
      .mockResolvedValueOnce({ ok: true,  status: 200, json: vi.fn().mockResolvedValue({ token: 'new-token' }) })
      .mockResolvedValueOnce({ ok: true,  status: 200 });

    const res = await fetchWithAuth('/api/protected');
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(res.status).toBe(200);
  });
});

// ══════════════════════════════════════════════════════════
describe('waitForPiSDK', () => {
  it('resolves immediately if Pi is ready', async () => {
    window.__TEC_PI_READY = true;
    (window as Window & { Pi?: unknown }).Pi = { authenticate: vi.fn() };
    await expect(waitForPiSDK()).resolves.toBeUndefined();
    delete window.__TEC_PI_READY;
  });

  it('rejects if Pi error flag is set', async () => {
    window.__TEC_PI_ERROR = true;
    await expect(waitForPiSDK()).rejects.toThrow();
    delete window.__TEC_PI_ERROR;
  });

  it('resolves on tec-pi-ready event', async () => {
    const promise = waitForPiSDK(2000);
    window.dispatchEvent(new Event('tec-pi-ready'));
    await expect(promise).resolves.toBeUndefined();
  });

  it('rejects on tec-pi-error event', async () => {
    const promise = waitForPiSDK(2000);
    window.dispatchEvent(new Event('tec-pi-error'));
    await expect(promise).rejects.toThrow();
  });
});

// ══════════════════════════════════════════════════════════
describe('loginWithPi', () => {
  beforeEach(() => {
    (window as Window & { Pi?: unknown }).Pi = {
      authenticate: vi.fn().mockResolvedValue({
        accessToken: 'pi-access-token',
        user:        { uid: 'pi-uid', username: 'yasser' },
      }),
      init:          vi.fn(),
      createPayment: vi.fn(),
    };
    window.__TEC_PI_READY = true;

    mockFetch({
      ok:   true,
      json: vi.fn().mockResolvedValue({
        success:   true,
        isNewUser: false,
        user: {
          id:               'user-uuid',
          piId:             'pi-uid',
          piUsername:       'yasser',
          role:             'user',
          subscriptionPlan: 'FREE',
          createdAt:        '2026-01-01',
        },
      }),
    });
  });

  afterEach(() => {
    delete window.__TEC_PI_READY;
    delete (window as Window & { Pi?: unknown }).Pi;
  });

  it('throws if not in Pi Browser', async () => {
    delete (window as Window & { Pi?: unknown }).Pi;
    await expect(loginWithPi()).rejects.toThrow();
  });

  it('returns user data on success', async () => {
    const result = await loginWithPi();
    expect(result.success).toBe(true);
    expect(result.user.piUsername).toBe('yasser');
  });

  it('throws on failed login response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok:     false,
      status: 401,
      json:   vi.fn().mockResolvedValue({}),
    });
    await expect(loginWithPi()).rejects.toThrow();
  });
});
