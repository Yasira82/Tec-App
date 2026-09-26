/**
 * The Hub's SSO handoff matches the target's ORIGIN exactly.
 *
 * It used `target.startsWith(allowed)`, which accepted
 * `https://hub.tecosystem.app.evil.com/…`. The callback was built from the
 * matched entry, so nothing leaked — but an allowlist should not depend on that
 * to hold. Run against the real route with a real session.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { GET } from '@/app/api/auth/sso/route';

const JWT_SECRET = 'jwt-secret-for-tests-at-least-32-chars!!';

beforeEach(() => {
  process.env.SSO_SECRET = 'sso-secret-for-tests-at-least-32-chars!!';
  process.env.JWT_SECRET = JWT_SECRET;
});

const withSession = async (target: string) => {
  const token = await new SignJWT({ sub: 'u1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(JWT_SECRET));
  const u = new URL('https://hub.tecosystem.app/api/auth/sso');
  u.searchParams.set('target', target);
  const req = new NextRequest(u);
  req.cookies.set('tec_access_token', token);
  req.cookies.set('tec_user', JSON.stringify({ id: 'u1', piUsername: 'pioneer' }));
  return GET(req);
};

describe('/api/auth/sso matches the target origin exactly', () => {
  it('refuses a look-alike that only STARTS with an allowed origin', async () => {
    const res = await withSession('https://hub.tecosystem.app.evil.com/x');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_target');
  });

  it('refuses http on an allowed host', async () => {
    expect((await withSession('http://dx.tecosystem.app/app')).status).toBe(400);
  });

  it('still hands off to an allowed app, to that app\'s own callback', async () => {
    const res = await withSession('https://dx.tecosystem.app/app?q=1');
    expect(res.status).toBe(307);
    const to = new URL(res.headers.get('location') as string);
    expect(to.origin).toBe('https://dx.tecosystem.app');
    expect(to.pathname).toBe('/api/auth/sso-callback');
    expect(to.searchParams.get('redirect')).toBe('/app?q=1');
  });
});
