import type { TecUser } from '@/types/pi.types';

// In-memory TEC session — the cookie-independent session transport (C-123 §7).
//
// Pi Browser's cookie behavior is non-deterministic across its contexts
// (top-level tab vs embedded webview have separate, differently-restricted
// cookie jars). Cookies therefore CANNOT be the thing the app depends on to
// open. This module holds the session in memory for the lifetime of the page;
// BFF calls attach it as an Authorization header. Cookies remain a best-effort
// accelerator (they survive reloads when the context allows it) — never a
// requirement. Not localStorage/sessionStorage — ADR-001 still holds; memory
// only, re-established via silent Pi auth on each cold load if cookies failed.

let accessToken: string | null = null;
let sessionUser: TecUser | null = null;

export const tecSession = {
  set(token: string | null, user: TecUser | null): void {
    accessToken = token || null;
    sessionUser = user ?? null;
  },
  clear(): void {
    accessToken = null;
    sessionUser = null;
  },
  get token(): string | null { return accessToken; },
  get user(): TecUser | null { return sessionUser; },
  /** Spread into fetch headers: adds Authorization only when a token is held. */
  authHeaders(): Record<string, string> {
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  },
};
