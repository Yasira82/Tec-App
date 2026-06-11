/**
 * Tests for small utility modules:
 * fetch-with-retry, health-check, e2e-mode, fetch-with-timeout,
 * bff-auth, bff-fetch, sdk, piClient, useDiagnostics, tec-ai-system-prompt
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Unmock sdk so we can test the real implementation (vitest.setup.ts mocks it globally)
vi.unmock('@/lib/sdk');

vi.mock('@/lib-client/pi/pi-auth', () => ({
  getAccessToken: vi.fn(() => null),
  getStoredUser:  vi.fn(() => null),
  getCsrfToken:   vi.fn(() => ''),
  ssoRedirect:    vi.fn(),
  loginWithPi:    vi.fn(),
  isPiBrowser:    vi.fn(() => false),
  logout:         vi.fn(),
}));

vi.mock('@yasser172/tec-sdk', () => ({
  TecSdk: class TecSdk {
    constructor(_opts: any) {}
    payment = {};
    auth    = {};
    commerce= {};
  },
}));

// ── tec-ai-system-prompt (import alone covers the file) ──────────
describe('tec-ai-system-prompt', () => {
  it('exports TEC_SYSTEM_PROMPT string', async () => {
    const mod = await import('@/lib/ai/tec-ai-system-prompt');
    expect(typeof mod.TEC_SYSTEM_PROMPT).toBe('string');
    expect(mod.TEC_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });
});

// ── fetch-with-retry ─────────────────────────────────────────────
describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns response on first success', async () => {
    const { fetchWithRetry } = await import('@/lib/fetch-with-retry');
    const mockRes = { ok: true, status: 200 } as Response;
    global.fetch = vi.fn().mockResolvedValue(mockRes);
    const res = await fetchWithRetry('https://example.com');
    expect(res.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on 500 and eventually succeeds', async () => {
    const { fetchWithRetry } = await import('@/lib/fetch-with-retry');
    const fail = { ok: false, status: 500 } as Response;
    const ok   = { ok: true,  status: 200 } as Response;
    global.fetch = vi.fn()
      .mockResolvedValueOnce(fail)
      .mockResolvedValueOnce(ok);

    const onRetry = vi.fn();
    const promise = fetchWithRetry('https://example.com', { baseDelay: 10, onRetry });
    await vi.runAllTimersAsync();
    const res = await promise;
    expect(res.ok).toBe(true);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('returns last bad response after max retries', async () => {
    const { fetchWithRetry } = await import('@/lib/fetch-with-retry');
    const fail = { ok: false, status: 500 } as Response;
    global.fetch = vi.fn().mockResolvedValue(fail);
    const promise = fetchWithRetry('https://example.com', { maxRetries: 2, baseDelay: 10 });
    await vi.runAllTimersAsync();
    const res = await promise;
    expect(res.status).toBe(500);
  });

  it('throws on network error after max retries', async () => {
    const { fetchWithRetry } = await import('@/lib/fetch-with-retry');
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    // maxRetries:1 → no delay on last attempt → promise rejects immediately
    await expect(
      fetchWithRetry('https://example.com', { maxRetries: 1, baseDelay: 10 })
    ).rejects.toThrow('Network error');
  });

  it('does not retry on 200', async () => {
    const { fetchWithRetry } = await import('@/lib/fetch-with-retry');
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
    await fetchWithRetry('https://example.com');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on 429, 502, 503, 504', async () => {
    const { fetchWithRetry } = await import('@/lib/fetch-with-retry');
    for (const status of [429, 502, 503, 504]) {
      const fail = { ok: false, status } as Response;
      const ok   = { ok: true,  status: 200 } as Response;
      global.fetch = vi.fn()
        .mockResolvedValueOnce(fail)
        .mockResolvedValueOnce(ok);
      const promise = fetchWithRetry(`https://example.com/${status}`, { baseDelay: 10 });
      await vi.runAllTimersAsync();
      const res = await promise;
      expect(res.ok).toBe(true);
    }
  });
});

// ── health-check ──────────────────────────────────────────────────
describe('checkBackendHealth', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns online=true when health endpoint returns ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', online: true }),
    } as any);
    const { checkBackendHealth } = await import('@/lib/health-check');
    const result = await checkBackendHealth();
    expect(result.online).toBe(true);
  });

  it('returns online=false when fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const { checkBackendHealth } = await import('@/lib/health-check');
    const result = await checkBackendHealth();
    expect(result.online).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns online=false when response not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 } as any);
    const { checkBackendHealth } = await import('@/lib/health-check');
    const result = await checkBackendHealth();
    expect(result.online).toBe(false);
  });

  it('returns services when provided', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        online: true,
        services: { auth: { status: 'ok' } },
      }),
    } as any);
    const { checkBackendHealth } = await import('@/lib/health-check');
    const result = await checkBackendHealth();
    expect(result.services).toBeDefined();
  });
});

// ── e2e-mode ──────────────────────────────────────────────────────
describe('e2e-mode', () => {
  const origEnv = { ...process.env };
  afterEach(() => { process.env = { ...origEnv }; });

  it('isE2eMode returns false by default', async () => {
    process.env.E2E_MODE = undefined as any;
    process.env.NEXT_PUBLIC_E2E_MODE = undefined as any;
    process.env.CI = undefined as any;
    const { isE2eMode } = await import('@/lib/server/e2e-mode');
    expect(isE2eMode()).toBe(false);
  });

  it('isE2eMode returns true when E2E_MODE=true', async () => {
    process.env.E2E_MODE = 'true';
    const { isE2eMode } = await import('@/lib/server/e2e-mode');
    expect(isE2eMode()).toBe(true);
  });

  it('isE2eMode returns true when NEXT_PUBLIC_E2E_MODE=true', async () => {
    process.env.NEXT_PUBLIC_E2E_MODE = 'true';
    const { isE2eMode } = await import('@/lib/server/e2e-mode');
    expect(isE2eMode()).toBe(true);
  });

  it('e2eStub returns a NextResponse', async () => {
    const { e2eStub } = await import('@/lib/server/e2e-mode');
    const res = e2eStub(200, { extra: 'field' });
    expect(res).toBeTruthy();
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.extra).toBe('field');
  });

  it('e2eStub with error status has success=false', async () => {
    const { e2eStub } = await import('@/lib/server/e2e-mode');
    const res = e2eStub(404);
    const data = await res.json();
    expect(data.success).toBe(false);
  });
});

// ── fetch-with-timeout ────────────────────────────────────────────
describe('fetchWithTimeout', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('resolves when fetch succeeds in time', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 } as any);
    const { fetchWithTimeout } = await import('@/lib/server/fetch-with-timeout');
    const res = await fetchWithTimeout('https://example.com', {}, 5000);
    expect(res.ok).toBe(true);
  });

  it('passes through fetch options', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 } as any);
    const { fetchWithTimeout } = await import('@/lib/server/fetch-with-timeout');
    await fetchWithTimeout('https://example.com', { method: 'POST' }, 3000);
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

// ── piClient ──────────────────────────────────────────────────────
describe('piClient', () => {
  it('initPi returns null on server side (no window)', async () => {
    const { initPi } = await import('@/lib-client/pi/piClient');
    // In happy-dom, window exists but window.Pi doesn't
    expect(initPi()).toBeNull();
  });

  it('initPi returns null when window.Pi missing', async () => {
    const { initPi } = await import('@/lib-client/pi/piClient');
    (window as any).Pi = undefined;
    const result = initPi({ version: '2.0', sandbox: true });
    expect(result).toBeNull();
  });

  it('initPi calls Pi.init and returns Pi when window.Pi exists', async () => {
    const mockInit = vi.fn();
    (window as any).Pi = { init: mockInit, createPayment: vi.fn() };
    const { initPi } = await import('@/lib-client/pi/piClient');
    const result = initPi({ version: '2.0', sandbox: true });
    expect(result).toBeDefined();
    expect(mockInit).toHaveBeenCalledWith({ version: '2.0', sandbox: true });
    (window as any).Pi = undefined;
  });

  it('initPi uses default options when none provided', async () => {
    const mockInit = vi.fn();
    (window as any).Pi = { init: mockInit };
    const { initPi } = await import('@/lib-client/pi/piClient');
    initPi();
    expect(mockInit).toHaveBeenCalledWith({ version: '2.0', sandbox: true });
    (window as any).Pi = undefined;
  });
});

// ── sdk (identitySdk + getToken + getUserId) ──────────────────────
describe('sdk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports sdk instance', async () => {
    const mod = await import('@/lib/sdk');
    expect(mod.sdk).toBeDefined();
    expect(mod.default).toBeDefined();
  });

  it('getToken returns access token from cookie', async () => {
    const { getStoredUser, getAccessToken } = await import('@/lib-client/pi/pi-auth');
    vi.mocked(getAccessToken).mockReturnValue('my-token');
    const { getToken } = await import('@/lib/sdk');
    expect(getToken()).toBe('my-token');
  });

  it('getToken returns null when no token', async () => {
    const { getAccessToken } = await import('@/lib-client/pi/pi-auth');
    vi.mocked(getAccessToken).mockReturnValue(null);
    const { getToken } = await import('@/lib/sdk');
    expect(getToken()).toBeNull();
  });

  it('getUserId returns user id from stored user', async () => {
    const { getStoredUser } = await import('@/lib-client/pi/pi-auth');
    vi.mocked(getStoredUser).mockReturnValue({ id: 'user-123', username: 'alice' } as any);
    const { getUserId } = await import('@/lib/sdk');
    expect(getUserId()).toBe('user-123');
  });

  it('getUserId falls back to uid when no id', async () => {
    const { getStoredUser } = await import('@/lib-client/pi/pi-auth');
    vi.mocked(getStoredUser).mockReturnValue({ uid: 'uid-456', username: 'bob' } as any);
    const { getUserId } = await import('@/lib/sdk');
    expect(getUserId()).toBe('uid-456');
  });

  it('getUserId returns null when no stored user', async () => {
    const { getStoredUser } = await import('@/lib-client/pi/pi-auth');
    vi.mocked(getStoredUser).mockReturnValue(null);
    const { getUserId } = await import('@/lib/sdk');
    expect(getUserId()).toBeNull();
  });

  it('identitySdk.getMe calls /api/identity/me', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ id: 'u-1' }),
    } as any);
    const { identitySdk } = await import('@/lib/sdk');
    const result = await identitySdk.getMe();
    expect(fetchSpy).toHaveBeenCalledWith('/api/identity/me', expect.objectContaining({ credentials: 'include' }));
    fetchSpy.mockRestore();
  });

  it('identitySdk.getProfile calls /api/identity/profile GET', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ displayName: 'Alice' }),
    } as any);
    const { identitySdk } = await import('@/lib/sdk');
    await identitySdk.getProfile();
    expect(fetchSpy).toHaveBeenCalledWith('/api/identity/profile', expect.objectContaining({ credentials: 'include' }));
    fetchSpy.mockRestore();
  });

  it('identitySdk.updateProfile calls /api/identity/profile PATCH', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ success: true }),
    } as any);
    const { identitySdk } = await import('@/lib/sdk');
    await identitySdk.updateProfile({ displayName: 'Bob' });
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/identity/profile',
      expect.objectContaining({ method: 'PATCH', credentials: 'include' })
    );
    fetchSpy.mockRestore();
  });

  it('identitySdk.getKyc calls /api/identity/kyc', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ status: 'verified' }),
    } as any);
    const { identitySdk } = await import('@/lib/sdk');
    await identitySdk.getKyc();
    expect(fetchSpy).toHaveBeenCalledWith('/api/identity/kyc', expect.objectContaining({ credentials: 'include' }));
    fetchSpy.mockRestore();
  });

  it('identitySdk.getRoles calls /api/identity/roles', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ roles: ['user'] }),
    } as any);
    const { identitySdk } = await import('@/lib/sdk');
    await identitySdk.getRoles();
    expect(fetchSpy).toHaveBeenCalledWith('/api/identity/roles', expect.objectContaining({ credentials: 'include' }));
    fetchSpy.mockRestore();
  });
});
