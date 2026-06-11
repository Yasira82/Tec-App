/**
 * Tests for lib/bff-fetch.ts — bffFetch, attemptTokenRefresh, buildExpiredResponse
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn((name: string) => {
      if (name === 'tec_refresh_token') return { value: 'refresh-tok' };
      return undefined;
    }),
  }),
}));

import { cookies } from 'next/headers';
const mockCookies = vi.mocked(cookies);

beforeEach(() => {
  process.env.API_GATEWAY_URL  = 'https://gw.test';
  process.env.SERVICE_SECRET   = 'svc-secret';
  vi.resetAllMocks();
  mockCookies.mockResolvedValue({
    get: vi.fn((name: string) => {
      if (name === 'tec_refresh_token') return { value: 'refresh-tok' };
      return undefined;
    }),
  } as any);
});

// ── bffFetch ──────────────────────────────────────────────────
describe('bffFetch', () => {
  it('returns ok result on 200 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok:     true,
      status: 200,
      json:   async () => ({ data: 'result' }),
    } as Response);

    const { bffFetch } = await import('@/lib/bff-fetch');
    const result = await bffFetch('/api/test', { accessToken: 'tok' });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.error).toBeNull();
  });

  it('returns error on network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const { bffFetch } = await import('@/lib/bff-fetch');
    const result = await bffFetch('/api/test', { accessToken: 'tok' });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.error).toContain('ECONNREFUSED');
  });

  it('returns tokenExpired=true on 401 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok:     false,
      status: 401,
      json:   async () => ({ error: { code: 'TOKEN_EXPIRED' } }),
    } as Response);
    const { bffFetch } = await import('@/lib/bff-fetch');
    const result = await bffFetch('/api/test', { accessToken: 'tok' });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.tokenExpired).toBe(true);
  });

  it('returns error on non-ok HTTP status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok:     false,
      status: 503,
      json:   async () => ({ error: { message: 'Service Unavailable' } }),
    } as Response);
    const { bffFetch } = await import('@/lib/bff-fetch');
    const result = await bffFetch('/api/test', { accessToken: 'tok' });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(503);
    expect(result.error).toBe('Service Unavailable');
  });

  it('handles invalid JSON response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok:     true,
      status: 200,
      json:   async () => { throw new Error('invalid json'); },
    } as any);
    const { bffFetch } = await import('@/lib/bff-fetch');
    const result = await bffFetch('/api/test', { accessToken: 'tok' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Invalid JSON');
  });

  it('adds Idempotency-Key header when provided', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({}),
    } as Response);
    const { bffFetch } = await import('@/lib/bff-fetch');
    await bffFetch('/api/test', { accessToken: 'tok', idempotencyKey: 'idem-key' });
    const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers?.['Idempotency-Key']).toBe('idem-key');
  });

  it('sends POST body as JSON', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({}),
    } as Response);
    const { bffFetch } = await import('@/lib/bff-fetch');
    await bffFetch('/api/test', { accessToken: 'tok', method: 'POST', body: { foo: 'bar' } });
    const body = mockFetch.mock.calls[0][1]?.body as string;
    expect(JSON.parse(body)).toEqual({ foo: 'bar' });
  });

  it('includes x-service-secret header on each request', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({}),
    } as Response);
    const { bffFetch } = await import('@/lib/bff-fetch');
    await bffFetch('/api/test', { accessToken: 'tok' });
    const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers?.['x-service-secret']).toBe('svc-secret');
  });
});

// ── attemptTokenRefresh ───────────────────────────────────────
describe('attemptTokenRefresh', () => {
  it('returns new access token on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok:   true,
      json: async () => ({ data: { accessToken: 'new-tok' } }),
    } as Response);
    const { attemptTokenRefresh } = await import('@/lib/bff-fetch');
    const token = await attemptTokenRefresh();
    expect(token).toBe('new-tok');
  });

  it('returns null when no refresh token in cookie', async () => {
    mockCookies.mockResolvedValueOnce({
      get: vi.fn(() => undefined),
    } as any);
    const { attemptTokenRefresh } = await import('@/lib/bff-fetch');
    const token = await attemptTokenRefresh();
    expect(token).toBeNull();
  });

  it('returns null when gateway refresh fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false, json: async () => ({}),
    } as Response);
    const { attemptTokenRefresh } = await import('@/lib/bff-fetch');
    const token = await attemptTokenRefresh();
    expect(token).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));
    const { attemptTokenRefresh } = await import('@/lib/bff-fetch');
    const token = await attemptTokenRefresh();
    expect(token).toBeNull();
  });
});

// ── buildExpiredResponse ──────────────────────────────────────
describe('buildExpiredResponse', () => {
  it('returns 401 NextResponse', async () => {
    const { buildExpiredResponse } = await import('@/lib/bff-fetch');
    const res = buildExpiredResponse();
    expect(res.status).toBe(401);
  });

  it('clears all auth cookies', async () => {
    const { buildExpiredResponse } = await import('@/lib/bff-fetch');
    const res = buildExpiredResponse();
    const cookieNames = res.cookies.getAll().map((c: { name: string }) => c.name);
    expect(cookieNames).toContain('tec_access_token');
    expect(cookieNames).toContain('tec_user');
    expect(cookieNames).toContain('tec_csrf');
  });

  it('returns SESSION_EXPIRED error code', async () => {
    const { buildExpiredResponse } = await import('@/lib/bff-fetch');
    const res  = buildExpiredResponse();
    const body = await res.json();
    expect(body.error.code).toBe('SESSION_EXPIRED');
  });
});
