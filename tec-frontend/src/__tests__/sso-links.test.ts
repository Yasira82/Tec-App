/**
 * One-time sign-in links, minted on the Hub for the apps a Hub page opens
 * (C-123 §12).
 *
 * The Quest and the campaign open an app standalone so Pi counts the visit as
 * the app's; the app then arrived signed out. Sending it back to the Hub from
 * there cannot work (§11). The link has to be signed BEFORE the visit leaves.
 *
 * Run against the real route and the real handoff: what matters is the URL.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { POST } from '@/app/api/auth/sso-links/route';

const SSO_SECRET = 'sso-secret-for-tests-at-least-32-chars!!';
const JWT_SECRET = 'jwt-secret-for-tests-at-least-32-chars!!';

beforeEach(() => {
  process.env.SSO_SECRET = SSO_SECRET;
  process.env.JWT_SECRET = JWT_SECRET;
});

const session = async () => {
  const token = await new SignJWT({ sub: 'u1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(JWT_SECRET));
  // As the browser holds it: tec_user is encodeURIComponent(JSON) (sso-callback).
  return {
    tec_access_token: token,
    tec_user: JSON.stringify({ id: 'u1', piUsername: 'pioneer' }),
    tec_csrf: 'c1',
  };
};

const ask = (targets: unknown, cookies?: Record<string, string>) => {
  const req = new NextRequest('https://hub.tecosystem.app/api/auth/sso-links', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ targets }),
  });
  for (const [k, v] of Object.entries(cookies ?? {})) req.cookies.set(k, v);
  return POST(req);
};

describe('POST /api/auth/sso-links', () => {
  it('signs a link straight to the app\'s own sso-callback, keeping the path and the Quest mark', async () => {
    const res = await ask(['https://dx.tecosystem.app/?q=1'], await session());
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const { links } = await res.json();
    const link = new URL(links['https://dx.tecosystem.app/?q=1']);
    // The app's OWN domain — the only thing in the tab (§9).
    expect(link.origin).toBe('https://dx.tecosystem.app');
    expect(link.pathname).toBe('/api/auth/sso-callback');
    expect(link.searchParams.get('redirect')).toBe('/?q=1');
    // The same one-time token the Hub's own handoff issues, for THIS app only.
    const { payload } = await jwtVerify(link.searchParams.get('token') as string,
      new TextEncoder().encode(SSO_SECRET), { issuer: 'tec.pi', audience: 'https://dx.tecosystem.app' });
    expect(payload.jti).toBeTruthy();
    expect((payload.exp as number) - (payload.iat as number)).toBe(300);
  });

  it('gives each target its own token', async () => {
    const t = ['https://dx.tecosystem.app/?q=1', 'https://alert.tecosystem.app/?q=1'];
    const { links } = await (await ask(t, await session())).json();
    const tok = (u: string) => new URL(u).searchParams.get('token');
    expect(tok(links[t[0]])).not.toBe(tok(links[t[1]]));
  });

  it('leaves out a target outside the allowlist — the page keeps its plain link', async () => {
    const { links } = await (await ask(
      ['https://hub.tecosystem.app.evil.com/x', 'https://dx.tecosystem.app/?q=1'], await session(),
    )).json();
    expect(Object.keys(links)).toEqual(['https://dx.tecosystem.app/?q=1']);
  });

  it('without a Hub session signs nothing', async () => {
    const res = await ask(['https://dx.tecosystem.app/?q=1']);
    expect(res.status).toBe(401);
    expect((await res.json()).links).toEqual({});
  });

  it('ignores junk and caps the batch', async () => {
    const many = Array.from({ length: 60 }, (_, i) => `https://dx.tecosystem.app/?n=${i}`);
    const { links } = await (await ask([42, null, ...many], await session())).json();
    expect(Object.keys(links)).toHaveLength(40);
  });

  it('is CSRF-guarded: it returns tokens, so it must never answer a cross-site POST', () => {
    const mw = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf8');
    expect(mw).toMatch(/'\/api\/auth\/sso-links'/);
  });
});
