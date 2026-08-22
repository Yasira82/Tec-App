/**
 * "Am I signed in?" has ONE answer, and it is not the cookie jar.
 *
 * Per C-123 §7 a Pi Browser context can refuse cookies outright; the session
 * then lives only in `tecSession` (in memory, re-established by silent Pi auth).
 * The Hub home already read it that way through `bffFetch`, which is why the
 * balance loaded there — while /dashboard/wallet, /hub/notifications and
 * /dashboard/orders all reported "Not authenticated" on the very same live
 * session. Three screens asking the question in the one place the answer is
 * allowed to be missing.
 *
 * These assertions hold the shared readers to memory-first, and hold the hooks
 * to using them.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { tecSession }                     from '@/lib-client/pi/tec-session';
import { sessionToken, sessionUserId }    from '@/lib-client/pi/session-source';

const setCookies = (v: string) => {
  Object.defineProperty(document, 'cookie', { value: v, writable: true, configurable: true });
};

beforeEach(() => { tecSession.clear(); setCookies(''); });
afterEach(()  => { tecSession.clear(); });

describe('sessionToken', () => {
  it('finds the token in memory when the browser refused every cookie', () => {
    tecSession.set('mem-token', { id: 'u-1' } as never);
    expect(sessionToken()).toBe('mem-token');
  });

  it('falls back to the cookie when memory is empty (a plain page reload)', () => {
    setCookies('tec_access_token=cookie-token');
    expect(sessionToken()).toBe('cookie-token');
  });

  it('prefers memory over a stale cookie', () => {
    // After a silent re-auth the memory token is the fresh one; the cookie may
    // still hold the expired value the context never managed to update.
    setCookies('tec_access_token=stale');
    tecSession.set('fresh', { id: 'u-1' } as never);
    expect(sessionToken()).toBe('fresh');
  });

  it('reports no session when there genuinely is none', () => {
    expect(sessionToken()).toBeNull();
  });
});

describe('sessionUserId', () => {
  it('reads the id from the in-memory user', () => {
    tecSession.set('t', { id: 'u-42' } as never);
    expect(sessionUserId()).toBe('u-42');
  });

  it('accepts `uid` as well as `id` — both shapes are in circulation', () => {
    tecSession.set('t', { uid: 'u-99' } as never);
    expect(sessionUserId()).toBe('u-99');
  });

  it('falls back to the tec_user cookie', () => {
    setCookies(`tec_user=${encodeURIComponent(JSON.stringify({ id: 'u-7' }))}`);
    expect(sessionUserId()).toBe('u-7');
  });

  it('returns null rather than guessing when nothing is available', () => {
    expect(sessionUserId()).toBeNull();
  });

  it('sees a user resolved by the SERVER, with no readable token or cookie', () => {
    // The path that was missing, and the one that broke the wallet page. Pi Browser
    // can send the session cookie while hiding it from JavaScript: `document.cookie`
    // is empty, no token is readable, and `/api/auth/me` still returns the user
    // because the SERVER can read the request cookie. `usePiAuth` records it via
    // `setUser`; without that, every screen asking "who is this?" saw nobody.
    tecSession.setUser({ id: 'u-server' } as never);
    expect(sessionUserId()).toBe('u-server');
    expect(sessionToken()).toBeNull();   // genuinely no token — and that is fine
  });

  it('setUser does not invent or clobber a token', () => {
    tecSession.set('real-token', { id: 'u-1' } as never);
    tecSession.setUser({ id: 'u-2' } as never);
    expect(sessionToken()).toBe('real-token');
    expect(sessionUserId()).toBe('u-2');
  });
});

describe('the hooks behind the Hub’s destinations', () => {
  const read = (f: string) =>
    readFileSync(join(process.cwd(), 'src/lib-client/hooks', f), 'utf8');

  const HOOKS = ['useWallet.ts', 'useNotifications.ts', 'useOrders.ts'];

  it.each(HOOKS)('%s decides auth from the session, not from the cookie', (f) => {
    const src = read(f);
    // `getAccessToken` / `getStoredUser` are the cookie-only readers. A hook that
    // gates its whole screen on them is the bug this test exists for.
    expect(src).not.toMatch(/\bgetAccessToken\b/);
    expect(src).not.toMatch(/\bgetStoredUser\b/);
    expect(src).toMatch(/from '@\/lib-client\/pi\/session-source'/);
  });

  it.each(HOOKS)('%s asks WHO is signed in, never whether a token is readable', (f) => {
    const src = read(f);
    // A readable token is a transport detail the browser may withhold. Gating a
    // screen on it denies sessions that are entirely real.
    expect(src).toMatch(/sessionUserId\(\)/);
    expect(src).not.toMatch(/sessionToken\(\)/);
  });

  it.each(HOOKS)('%s fetches through bffFetch, so one expired session self-heals', (f) => {
    const src = read(f);
    expect(src).toMatch(/bffFetch\(/);
    // A bare fetch to a BFF route would skip the Authorization header and the
    // single silent re-auth retry.
    expect(src).not.toMatch(/await fetch\(\s*['"`]\/api\//);
  });

  it.each(HOOKS)('%s reports the auth failure as a sentinel, not as English prose', (f) => {
    // A data hook has no locale. Prose here reached the screen untranslated.
    expect(read(f)).not.toMatch(/'Not authenticated'/);
  });
});
