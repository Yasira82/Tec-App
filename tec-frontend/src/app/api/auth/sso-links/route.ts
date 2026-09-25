import { NextRequest, NextResponse } from 'next/server';
import { GET as handoff } from '../sso/route';
import { isAllowedAppUrl } from '@/domains/allowed-origins';

/**
 * POST /api/auth/sso-links  { targets: string[] }  →  { links: { [target]: callbackUrl } }
 *
 * One-time sign-in links for the apps a Hub page is about to open — minted HERE,
 * while the visitor is still on the Hub, where their session is (C-123 §12).
 *
 * ── Why ─────────────────────────────────────────────────────────────────────
 * The Founding Quest and the reward campaign open an app standalone on purpose
 * (no referrer, no Hub hop) so Pi counts the visit as the APP's (§9). The price
 * was that the app arrived with no session: "Not signed in". Sending the app to
 * the Hub afterwards cannot work — Pi is bound to the app by then and the Hub
 * cannot sign in inside that context; the one deploy that tried stranded every
 * visit (§11). So the Hub does its part BEFORE the visit leaves: the link the
 * visitor taps goes straight to the app's own `/api/auth/sso-callback` with a
 * token in it. The app's domain is the only thing in that tab, the link keeps
 * `rel="noreferrer"`, and the landing never marks the tab Hub-owned — so the app
 * still loads Pi and still counts, and it arrives signed in.
 *
 * ── How ─────────────────────────────────────────────────────────────────────
 * Each link comes from the Hub's OWN handoff (`/api/auth/sso`), called in
 * process: same allowlist, same refresh, same 5-minute one-time token. Nothing
 * here signs anything. Targets are handled one after another so that a refresh
 * which rotates the session is applied to the next call — refresh tokens are
 * single-use, and two parallel handoffs would burn one on the other.
 *
 * The response carries tokens, so it is POST-only, CSRF-guarded in middleware,
 * `no-store`, and never served cross-origin.
 */

const MAX_TARGETS = 40;
const MAX_TARGET_LENGTH = 2048;

const decode = (v: string): string => {
  try { return decodeURIComponent(v); } catch { return v; }
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { targets?: unknown } | null;
  const targets = Array.isArray(body?.targets)
    ? [...new Set(body.targets.filter(
        // Matched on the ORIGIN, exactly — stricter than the handoff's own prefix
        // test, which would accept `https://hub.tecosystem.app.evil.com`.
        (t): t is string => typeof t === 'string' && t.length > 0 && t.length <= MAX_TARGET_LENGTH
          && isAllowedAppUrl(t),
      ))].slice(0, MAX_TARGETS)
    : [];

  const noStore = { 'Cache-Control': 'no-store' };
  if (!req.cookies.get('tec_access_token')?.value || !req.cookies.get('tec_user')?.value) {
    return NextResponse.json({ links: {} }, { status: 401, headers: noStore });
  }

  // name → value (decoded), carried from call to call. Set through the cookie
  // API, not a raw `Cookie` header: a Request drops that header as forbidden.
  const jar = new Map(req.cookies.getAll().map((c) => [c.name, c.value] as const));
  const rotated: string[] = [];
  const links: Record<string, string> = {};

  for (const target of targets) {
    const url = new URL('/api/auth/sso', req.nextUrl.origin);
    url.searchParams.set('target', target);
    const inner = new NextRequest(url);
    for (const [k, v] of jar) inner.cookies.set(k, v);
    const res = await handoff(inner);

    // A refresh inside the handoff rotates the session: carry it forward.
    for (const sc of res.headers.getSetCookie?.() ?? []) {
      rotated.push(sc);
      const pair = sc.split(';')[0] ?? '';
      const i = pair.indexOf('=');
      if (i > 0) jar.set(pair.slice(0, i).trim(), decode(pair.slice(i + 1).trim()));
    }

    // Only a real handoff becomes a link. Anything else — a target outside the
    // allowlist (400), a session the Hub could not use (a bounce to its own
    // sign-in) — leaves the plain app link in place, which is today's behaviour.
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      try {
        if (new URL(location).pathname === '/api/auth/sso-callback') links[target] = location;
      } catch { /* not a URL — not a link */ }
    }
  }

  const out = NextResponse.json({ links }, { headers: noStore });
  for (const c of rotated) out.headers.append('Set-Cookie', c);
  return out;
}
