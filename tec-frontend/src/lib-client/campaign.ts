// Campaign attribution — capture first-touch utm_* from the landing URL, mirroring
// the referral capture (lib-client/referral.ts). A utm tag is marketing metadata,
// NOT an auth token, so a client cookie is allowed (the "no localStorage/sessionStorage
// for tokens" rule is about tec_access_token etc.). Kept in a `tec_src` cookie (+
// sessionStorage) so it survives the full-page SSO redirect and a fresh tab, and
// reaches the pioneer/open call — where the backend records it FIRST-TOUCH per
// Pioneer. SameSite=Lax is fine (this is not a session cookie — C-123 forbids `lax`
// on SESSION cookies only).

export const SRC_KEY = 'tec_src';
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days
const UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;

// Each utm value: lowercase, [a-z0-9_.-] only, max 40 chars. Keeps the tag clean and
// groupBy-able server-side, and bounded so it can never be abused as a payload.
const clean = (raw: string | null | undefined): string =>
  (raw ?? '').trim().toLowerCase().replace(/[^a-z0-9_.\-]/g, '').slice(0, 40);

const readCookie = (name: string): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find((r) => r.startsWith(`${name}=`))?.split('=')?.[1] ?? '';
};

/**
 * Read utm_* from a query string and persist a compact first-touch source tag
 * ("source|medium|campaign|content", missing parts as "-"). Returns the tag, or ''.
 * First-touch: an already-captured source is never overwritten, so the ORIGINAL
 * channel that brought the visitor wins even after internal navigation.
 */
export function captureUtm(search: string): string {
  if (typeof window === 'undefined') return '';
  let tag = '';
  try {
    const q = new URLSearchParams(search);
    const parts = UTM_FIELDS.map((k) => clean(q.get(k)));
    if (parts.some(Boolean)) tag = parts.map((p) => p || '-').join('|');
  } catch {
    tag = '';
  }
  if (!tag || tag === '-|-|-|-') return getSource();
  const existing = getSource();
  if (existing) return existing; // first-touch — do not overwrite
  try { sessionStorage.setItem(SRC_KEY, tag); } catch { /* ignore */ }
  try { document.cookie = `${SRC_KEY}=${encodeURIComponent(tag)}; path=/; max-age=${MAX_AGE_S}; samesite=lax`; } catch { /* ignore */ }
  return tag;
}

/** The captured source tag (sessionStorage first, then cookie), or '' if none. */
export function getSource(): string {
  if (typeof window === 'undefined') return '';
  let v = '';
  try { v = sessionStorage.getItem(SRC_KEY) ?? ''; } catch { /* ignore */ }
  if (!v) { try { v = decodeURIComponent(readCookie(SRC_KEY) || ''); } catch { v = ''; } }
  return v && v.length <= 200 ? v : '';
}
