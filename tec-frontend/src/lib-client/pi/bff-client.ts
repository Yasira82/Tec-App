import { loginWithPi, isPiBrowser } from '@/lib-client/pi/pi-auth';
import { tecSession }               from '@/lib-client/pi/tec-session';
import type { TecUser }             from '@/types/pi.types';

// C-123 §7 — cookie-independent BFF client.
//
// In Pi Browser contexts that refuse cookies, the in-memory access token is the
// session. It expires after ~1h and there is no refresh cookie to renew it
// server-side — so a 401 mid-session is EXPECTED there. This client heals it:
// one silent Pi re-auth (promptless after first consent), then a single retry
// with the fresh token. Single-flight + cooldown so parallel calls or a broken
// backend can never trigger an auth storm; failure degrades quietly (the 401
// is returned, UI shows its empty/error state — never a logout, never a loop).

const REAUTH_COOLDOWN_MS = 30_000;

let inflight: Promise<TecUser | null> | null = null;
let lastAttemptAt = 0;

/** One silent Pi re-auth, shared by every caller (usePiAuth mount + 401 heal). */
export async function silentReauth(): Promise<TecUser | null> {
  if (!isPiBrowser()) return null;
  if (inflight) return inflight;
  if (Date.now() - lastAttemptAt < REAUTH_COOLDOWN_MS) return null;

  lastAttemptAt = Date.now();
  inflight = (async () => {
    try {
      const result = await loginWithPi(); // stores token+user in tecSession
      return result?.user ?? null;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * fetch() for authenticated BFF calls: attaches the in-memory Authorization
 * header (works with zero cookies) and self-heals an expired session once.
 */
export async function bffFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const doFetch = () => fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.headers as Record<string, string> ?? {}),
      ...tecSession.authHeaders(),
    },
  });

  const res = await doFetch();
  if (res.status !== 401) return res;

  const user = await silentReauth();
  if (!user) return res; // quiet degradation — no logout, no loop

  return doFetch();
}
