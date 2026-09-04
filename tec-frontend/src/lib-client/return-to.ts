'use client';

/**
 * Remember where someone was when the session could not be resolved.
 *
 * ── The behaviour this fixes ────────────────────────────────────────────────
 * Both `/dashboard` and `/hub` guard on `isAuthenticated` and, when it is
 * false, run `router.push('/')`. That is right about the destination and wrong
 * about everything else: it throws away where the person was standing. They
 * sign in again and land on the marketing page, then have to find their way
 * back to the screen they were already on.
 *
 * The bounce itself is not always a bug. In Pi Browser a session can take a
 * moment to resolve through `/api/auth/me`, and a reload starts from nothing.
 * What IS a bug is losing the destination while that happens.
 *
 * ── Why sessionStorage, and not a query parameter ───────────────────────────
 * A `?next=` parameter is a redirect target an attacker can craft and send to
 * someone — the open-redirect class this platform already guards against in
 * `sso-callback`. sessionStorage cannot be written by another origin, is
 * scoped to this tab, and dies with it. This app already relies on it for
 * `__tec_hub_entry`, so it is known to work on the one browser that matters.
 *
 * It is still validated on the way IN and on the way OUT: storage is not a
 * trust boundary, it is a convenience, and a value read back is treated as
 * input rather than as something we wrote.
 */

const KEY = '__tec_return_to';

/**
 * A path we are willing to send someone to after they sign in.
 *
 * Same-origin, absolute-from-root, and nothing that could become another site:
 * `//evil.com` is a protocol-relative URL that browsers happily treat as
 * external, which is why a bare `startsWith('/')` is not enough on its own.
 */
const isSafePath = (p: unknown): p is string =>
  typeof p === 'string' &&
  p.startsWith('/') &&
  !p.startsWith('//') &&
  !p.startsWith('/\\') &&
  p.length < 512;

/** Called by a guard just before it bounces someone to the landing page. */
export function rememberReturn(path: string): void {
  if (!isSafePath(path)) return;
  // The landing page is where we send people; remembering it would make the
  // return a no-op that still costs a navigation.
  if (path === '/') return;
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // Private mode, blocked storage, a browser that refuses it. The user simply
    // lands on the default destination — degraded, never broken.
  }
}

/**
 * Read the remembered path and CLEAR it, in one step.
 *
 * One-shot on purpose: a value that survives its use would send someone back
 * to the same screen on a later, unrelated sign-in — and they would have no
 * idea why.
 */
export function takeReturn(): string | null {
  try {
    const v = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return isSafePath(v) ? v : null;
  } catch {
    return null;
  }
}
