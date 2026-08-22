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
