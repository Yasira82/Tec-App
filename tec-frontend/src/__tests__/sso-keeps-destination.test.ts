/**
 * A trip to an app survives having to sign in on the way.
 *
 * Seen in the Vercel log on 2026-09-24: a pioneer tapped an app, the app sent
 * them to `/api/auth/sso`, the Hub had no session in that context and bounced
 * them to `/` bare — `sso 307 → me 401 → pi-login → /hub`. They signed in and
 * landed on the Hub, not the app. The sign-in button already finishes a trip
 * from `returnTo`; nobody was giving it one.
 *
 * Run against the real route: what matters is where the redirect points.
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/auth/sso/route';

const noSession = (target: string | null) => {
  const u = new URL('https://hub.tecosystem.app/api/auth/sso');
  if (target !== null) u.searchParams.set('target', target);
  return GET(new NextRequest(u));
};

const landing = async (target: string | null) => {
  const res = await noSession(target);
  expect(res.status).toBe(307);
  return new URL(res.headers.get('location') ?? '');
};

describe('/api/auth/sso without a Hub session', () => {
  it('sends the visitor to sign in, carrying the app they were going to', async () => {
    const to = await landing('https://zone.tecosystem.app/app?q=1');
    expect(to.pathname).toBe('/');
    expect(to.searchParams.get('returnTo')).toBe('https://zone.tecosystem.app/app?q=1');
  });

  it('carries nothing for an origin that only STARTS like an allowed one', async () => {
    const to = await landing('https://hub.tecosystem.app.evil.com/steal');
    expect(to.pathname).toBe('/');
    expect(to.searchParams.has('returnTo')).toBe(false);
  });

  it('carries nothing for a target outside the allowlist', async () => {
    expect((await landing('https://evil.example/app')).searchParams.has('returnTo')).toBe(false);
  });

  it('carries nothing for a malformed target, and nothing when there is none', async () => {
    expect((await landing('not a url')).searchParams.has('returnTo')).toBe(false);
    expect((await landing(null)).searchParams.has('returnTo')).toBe(false);
  });

  it('stays on the Hub — the redirect itself never leaves this origin', async () => {
    const to = await landing('https://zone.tecosystem.app/app');
    expect(to.origin).toBe('https://hub.tecosystem.app');
  });
});
