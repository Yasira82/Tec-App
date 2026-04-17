/**
 * VM-007 — Refresh token rotation completeness
 * Verifies new refresh token is issued on every rotation
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('VM-007 — Refresh token rotation', () => {

  beforeEach(() => {
    vi.resetModules();
  });

  it('issues new refresh token on rotation', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({
        token:        'new-access-token',
        refreshToken: 'new-refresh-token',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { POST } = await import('@/app/api/auth/refresh/route');
    const { NextRequest } = await import('next/server');

    const req = new NextRequest('http://localhost/api/auth/refresh', { method: 'POST' });
    Object.defineProperty(req, 'cookies', {
      value: { get: (name: string) => name === 'tec_refresh_token' ? { value: 'old-refresh' } : undefined },
    });

    const res = await POST(req);
    const cookies = res.cookies.getAll();

    // ✅ VM-007: must issue new refresh token
    const refreshCookie = cookies.find(c => c.name === 'tec_refresh_token');
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie?.value).toBe('new-refresh-token');
  });

  it('issues new access token on rotation', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({
        token:        'new-access-token',
        refreshToken: 'new-refresh-token',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { POST } = await import('@/app/api/auth/refresh/route');
    const { NextRequest } = await import('next/server');

    const req = new NextRequest('http://localhost/api/auth/refresh', { method: 'POST' });
    Object.defineProperty(req, 'cookies', {
      value: { get: (name: string) => name === 'tec_refresh_token' ? { value: 'old-refresh' } : undefined },
    });

    const res = await POST(req);
    const cookies = res.cookies.getAll();

    const accessCookie = cookies.find(c => c.name === 'tec_access_token');
    expect(accessCookie).toBeDefined();
    expect(accessCookie?.value).toBe('new-access-token');
  });

  it('response body contains new access token', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({
        token:        'new-access-token',
        refreshToken: 'new-refresh-token',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { POST } = await import('@/app/api/auth/refresh/route');
    const { NextRequest } = await import('next/server');

    const req = new NextRequest('http://localhost/api/auth/refresh', { method: 'POST' });
    Object.defineProperty(req, 'cookies', {
      value: { get: (name: string) => name === 'tec_refresh_token' ? { value: 'old-refresh' } : undefined },
    });

    const res  = await POST(req);
    const body = await res.json();
    expect(body.token).toBe('new-access-token');
  });
});
