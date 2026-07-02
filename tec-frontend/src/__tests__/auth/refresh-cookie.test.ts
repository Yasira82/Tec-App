/**
 * VM-001 — httpOnly consistency test
 * Verifies tec_access_token is set with httpOnly:false after refresh
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('VM-001 — refresh route cookie consistency', () => {

  beforeEach(() => {
    vi.resetModules();
  });

  it('tec_access_token has httpOnly:false (Pi Browser readable)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({ token: 'new-access-token', refreshToken: 'new-refresh-token' }),
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
    expect(accessCookie?.httpOnly).toBe(false);
    // sameSite MUST be 'none' + secure: embedded Pi Browser contexts reject
    // 'lax' cookies entirely (July 2026 login outage — Runtime Verified).
    // 'none' is the original platform contract; never downgrade to 'lax'.
    expect(accessCookie?.sameSite).toBe('none');
    expect(accessCookie?.secure).toBe(true);
  });

  it('tec_refresh_token has httpOnly:true (server only)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({ token: 'new-access-token', refreshToken: 'new-refresh-token' }),
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
    const refreshCookie = cookies.find(c => c.name === 'tec_refresh_token');

    expect(refreshCookie).toBeDefined();
    expect(refreshCookie?.httpOnly).toBe(true);
  });

  it('returns 401 when no refresh token cookie', async () => {
    const { POST } = await import('@/app/api/auth/refresh/route');
    const { NextRequest } = await import('next/server');

    const req = new NextRequest('http://localhost/api/auth/refresh', { method: 'POST' });
    Object.defineProperty(req, 'cookies', {
      value: { get: () => undefined },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
