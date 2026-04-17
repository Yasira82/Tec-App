/**
 * VM-001 — httpOnly consistency test
 * Verifies tec_access_token is set with httpOnly:false after refresh
 */
describe('VM-001 — refresh route cookie consistency', () => {

  it('tec_access_token has httpOnly:false (Pi Browser readable)', async () => {
    const { POST } = await import('@/app/api/auth/refresh/route');
    const { NextRequest } = await import('next/server');

    const mockFetch = jest.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({ token: 'new-access-token', refreshToken: 'new-refresh-token' }),
    });
    global.fetch = mockFetch;

    const req = new NextRequest('http://localhost/api/auth/refresh', {
      method: 'POST',
    });
    Object.defineProperty(req, 'cookies', {
      value: { get: (name: string) => name === 'tec_refresh_token' ? { value: 'old-refresh' } : undefined },
    });

    const res = await POST(req);

    // ✅ VM-001: tec_access_token must be httpOnly:false
    const cookies = res.cookies.getAll();
    const accessCookie = cookies.find(c => c.name === 'tec_access_token');

    expect(accessCookie).toBeDefined();
    expect(accessCookie?.httpOnly).toBe(false);
    expect(accessCookie?.sameSite).toBe('none');
    expect(accessCookie?.secure).toBe(true);
  });

  it('tec_refresh_token has httpOnly:true (server only)', async () => {
    const { POST } = await import('@/app/api/auth/refresh/route');
    const { NextRequest } = await import('next/server');

    const mockFetch = jest.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({ token: 'new-access-token', refreshToken: 'new-refresh-token' }),
    });
    global.fetch = mockFetch;

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
