import { tecSession } from './tec-session';

// One Pioneer, one account — for a session that is ALREADY open.
//
// auth-service resolves every sign-in and every refresh to the Pioneer's oldest
// account (tec-core-backend #395/#396). A session opened on a duplicate before
// that, though, keeps its access token for up to 24h, and nothing refreshes it
// while it is valid. Production, 2026-10-09: the owner signed out and back in
// three times and the Hub still showed 5π — the Vercel log has no POST to
// /api/auth/logout or /api/auth/pi-login in that window, and auth-service saw no
// request at all. The old session simply carried on.
//
// So once per tab, the Hub asks for ONE refresh. The refresh route answers with
// the account the session now belongs to (`accountId`); if that is not the account
// on screen, the page reloads onto it. Same account → nothing happens.
//
// Bounded to one attempt per tab by a sessionStorage flag (a flag, never a token —
// ADR-001). No sessionStorage → no attempt: a check that cannot remember it ran
// could reload forever.

const FLAG = '__tec_account_checked';

const csrf = (): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find((r) => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
};

export async function ensureCanonicalAccount(
  currentId: string | null | undefined,
  reload: () => void = () => window.location.reload(),
): Promise<boolean> {
  if (typeof window === 'undefined' || !currentId) return false;
  try {
    if (window.sessionStorage.getItem(FLAG)) return false;
    window.sessionStorage.setItem(FLAG, '1');
  } catch {
    return false;
  }

  try {
    const res = await fetch('/api/auth/refresh', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'x-csrf-token': csrf() },
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => null)) as { accountId?: unknown } | null;
    const accountId = typeof data?.accountId === 'string' ? data.accountId : null;
    if (!accountId || accountId === currentId) return false;

    // The in-memory token belongs to the old account, and the BFF prefers it over
    // the cookie — drop it so the reload reads the refreshed cookies.
    tecSession.clear();
    reload();
    return true;
  } catch {
    return false;
  }
}
