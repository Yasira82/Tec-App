import { tecSession }                    from '@/lib-client/pi/tec-session';
import { getAccessToken, getStoredUser } from '@/lib-client/pi/pi-auth';

/**
 * The session as the app ACTUALLY holds it — memory first, cookie second.
 *
 * `getAccessToken` / `getStoredUser` read cookies only, and per C-123 §7 a Pi
 * Browser context can refuse cookies outright: the session then lives solely in
 * `tecSession`, re-established by silent Pi auth. The Hub home already read it
 * that way (through `bffFetch`), which is why the balance loaded there while
 * /dashboard/wallet, /hub/notifications and /dashboard/orders all reported
 * "Not authenticated" on the very same live session — three screens asking the
 * question in the one place the answer is allowed to be missing.
 *
 * Any client hook deciding "am I signed in?" must use THESE, not the cookie
 * readers.
 *
 * It lives in its own module rather than inside `pi-auth` on purpose: a dozen
 * test files replace `pi-auth` wholesale with a hand-listed mock, so an export
 * added there is `undefined` at every one of those call sites. From here the
 * real function runs and reads through whatever `pi-auth` the test installed.
 */
export const sessionToken = (): string | null => tecSession.token ?? getAccessToken();

export const sessionUserId = (): string | null => {
  const u = (tecSession.user ?? getStoredUser()) as { id?: string; uid?: string } | null;
  return u?.id ?? u?.uid ?? null;
};
