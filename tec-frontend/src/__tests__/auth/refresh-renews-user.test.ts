/**
 * C-13 §1 / C-123 §2 — a refresh renews the WHOLE session, not just the token.
 *
 * pi-login gives tec_access_token and tec_user the same 24h life. Refresh used to
 * renew the token (and csrf) but never tec_user, so a day after sign-in the Hub
 * held a live token and no user: /api/auth/me answers 401 `no_user`, the page
 * says "Not signed in", and the wallet — which only needs the token — still
 * works. The fleet's refresh routes were fixed for this on 2026-09-24; the Hub's
 * was not, and the KB drift check found it.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

const USER = JSON.stringify({ id: 'u1', username: 'pioneer' });

async function refreshWith(cookies: Record<string, string>) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok:   true,
    json: async () => ({ token: 'new-access-token', refreshToken: 'new-refresh-token' }),
  }));
  const { POST } = await import('@/app/api/auth/refresh/route');
  const { NextRequest } = await import('next/server');
  const req = new NextRequest('http://localhost/api/auth/refresh', { method: 'POST' });
  Object.defineProperty(req, 'cookies', {
    value: { get: (name: string) => (name in cookies ? { value: cookies[name] } : undefined) },
  });
  return POST(req);
}

describe('Hub refresh renews tec_user with the token', () => {
  beforeEach(() => { vi.resetModules(); });

  it('re-issues tec_user with the same value, the same lifetime and the session attributes', async () => {
    const res = await refreshWith({ tec_refresh_token: 'old-refresh', tec_user: USER });
    const all = res.cookies.getAll();
    const user = all.find((c) => c.name === 'tec_user');
    const token = all.find((c) => c.name === 'tec_access_token');

    expect(user?.value).toBe(USER);           // copied, never invented
    expect(user?.maxAge).toBe(token?.maxAge); // they expire together
    expect(user?.sameSite).toBe('none');
    expect(user?.secure).toBe(true);
    expect(user?.partitioned).toBe(true);
    expect(user?.httpOnly).toBe(false);
  });

  it('does not invent a tec_user when the request carried none', async () => {
    const res = await refreshWith({ tec_refresh_token: 'old-refresh' });
    expect(res.cookies.getAll().find((c) => c.name === 'tec_user')).toBeUndefined();
  });
});
