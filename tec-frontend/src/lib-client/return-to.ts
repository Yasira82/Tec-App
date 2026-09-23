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

const KEY    = '__tec_return_to';
const ONWARD = '__tec_return_onward';

/**
 * How long a remembered destination stays good.
 *
 * A destination is written at the moment someone leaves — a tap on an app, a
 * guard bounce — and it means something only for the trip that follows. It
 * used to have no end, and that is how a tap on the campaign page, left
 * unconsumed because the person came back by another road, was still sitting
 * there later and sent a back press from the Quest to the campaign.
 */
const TTL_MS = 30 * 60 * 1000;

/** The onward hop is taken by the very next page load, or not at all. */
const ONWARD_TTL_MS = 60 * 1000;

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

/**
 * `path|writtenAt` — one entry, so the destination and its age cannot be
 * written apart and read together. A value with no timestamp (an older build)
 * reads as expired: it is exactly the kind of leftover this exists to ignore.
 */
function write(key: string, path: string): void {
  try {
    sessionStorage.setItem(key, `${path}|${Date.now()}`);
  } catch {
    // Private mode, blocked storage, a browser that refuses it. The user simply
    // lands on the default destination — degraded, never broken.
  }
}

function take(key: string, ttl: number): string | null {
  try {
    const raw = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    if (typeof raw !== 'string') return null;
    const cut  = raw.lastIndexOf('|');
    if (cut < 0) return null;
    const path = raw.slice(0, cut);
    const at   = Number(raw.slice(cut + 1));
    const age  = Date.now() - at;
    const fresh = Number.isFinite(at) && at > 0 && age >= 0 && age < ttl;
    return fresh && isSafePath(path) ? path : null;
  } catch {
    return null;
  }
}

/** Called just before someone leaves a screen they will want to come back to. */
export function rememberReturn(path: string): void {
  if (!isSafePath(path)) return;
  // The landing page is where we send people; remembering it would make the
  // return a no-op that still costs a navigation.
  if (path === '/') return;
  write(KEY, path);
}

/**
 * Read the remembered path and CLEAR it, in one step.
 *
 * One-shot on purpose: a value that survives its use would send someone back
 * to the same screen on a later, unrelated sign-in — and they would have no
 * idea why.
 */
export function takeReturn(): string | null {
  return take(KEY, TTL_MS);
}

/**
 * Forget any remembered destination.
 *
 * Called by a Hub screen the moment someone is standing on it. A destination
 * exists to bring a person back to where they were; once they ARE back — by
 * whatever road, including the browser's own history — whatever is stored is
 * about a trip that is over. Left in place, it fires on the next unrelated
 * visit to the landing page and sends them somewhere they did not ask to go.
 */
export function clearReturn(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch { /* storage blocked — there is nothing to clear */ }
}

/**
 * Pages whose parent is the Hub home, and so are returned to THROUGH it.
 *
 * Coming back from an app in Pi Browser surfaces on the landing page, and the
 * landing page used to `replace` itself with the destination. That put the
 * Quest where the landing page was — and the entry behind THAT is whatever the
 * SSO chain happened to leave, so the next back press went somewhere different
 * every time: the campaign, the app again, out of the browser. The person
 * expects the page they tapped from, and then the Hub.
 *
 * So the landing page replaces itself with `/hub` and the Hub pushes the
 * destination on top. The history now reads Hub → Quest, which is what "back"
 * then walks.
 */
export function returnsThroughHub(path: string): boolean {
  return path === '/pioneers' || path.startsWith('/pioneers/') || path.startsWith('/hub/');
}

/** Hand the Hub the page it should open once it has loaded. */
export function stageOnward(path: string): void {
  if (!isSafePath(path) || !returnsThroughHub(path)) return;
  write(ONWARD, path);
}

/** One-shot and short-lived: only the Hub load that follows may take it. */
export function takeOnward(): string | null {
  const p = take(ONWARD, ONWARD_TTL_MS);
  return p && returnsThroughHub(p) ? p : null;
}
