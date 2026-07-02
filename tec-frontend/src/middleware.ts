import { NextRequest, NextResponse } from 'next/server';

// '/hub' is CLIENT-guarded (C-123 §7): its shell must always render so the
// client can resolve the session cookie-independently (memory → /api/auth/me →
// silent Pi re-auth). A middleware cookie check here turned every cookie-less
// context into a hard "hub won't open". Data stays protected — every BFF route
// still fail-closes without a valid token (P6).
const PROTECTED_ROUTES  = ['/dashboard', '/profile', '/settings'];
const PUBLIC_HUB_ROUTES: string[] = [];
const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const CSRF_PROTECTED = [
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/wallet',
  '/api/kyc',
  '/api/notifications',
  '/api/assets',
  '/api/marketplace',
  '/api/commerce',
  '/api/subscriptions',
  '/api/payment',
  '/api/admin',
  '/api/ai',
  '/api/identity',
  '/api/bff/payment',
  '/api/bff/assets',
  '/api/bff/commerce',
  '/api/bff/identity',
  '/api/bff/notifications',
];

// Double-submit CSRF token cookie. Not a secret — same-origin policy stops
// cross-origin attackers from reading it. httpOnly:false so client JS can
// echo it back in the x-csrf-token header.
// sameSite:'none' — Pi Browser may load the app embedded, where 'lax' cookies
// are not stored/sent at all (July 2026 outage). 'none' works in both contexts.
const CSRF_COOKIE_OPTS = {
  httpOnly: false,
  secure:   true,
  sameSite: 'none' as const,
  partitioned: true,
  path:     '/',
  maxAge:   60 * 60 * 24,
};

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

// CSRF: a state-changing request is trusted if EITHER the double-submit token
// matches OR it is first-party (same-origin / a *.tecosystem.app origin).
// Pure double-submit proved unreliable across SSO domains and inside Pi Browser
// (sameSite=None cookies get dropped) → legit payment POSTs 403'd. Verifying
// the Origin is an OWASP-recommended, cookie-independent CSRF defense; a
// cross-site attacker cannot forge the browser-set Origin header.
function isTrustedCsrf(req: NextRequest): boolean {
  const cookie = req.cookies.get('tec_csrf')?.value ?? '';
  const header = req.headers.get('x-csrf-token') ?? '';
  if (cookie && header && timingSafeStringEqual(cookie, header)) return true;

  const host   = req.headers.get('host') ?? '';
  const origin = req.headers.get('origin');
  if (origin) {
    try {
      const oh = new URL(origin).host;
      if (oh === host || oh.endsWith('.tecosystem.app')) return true;
    } catch { /* malformed Origin → not trusted */ }
  }
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method       = req.method.toUpperCase();

  // ── Page protection ────────────────────────────────────────
  const isPublicHub  = PUBLIC_HUB_ROUTES.some(r => pathname.startsWith(r));
  const isProtected  = !isPublicHub && PROTECTED_ROUTES.some(r => pathname.startsWith(r));

  if (isProtected) {
    const token = req.cookies.get('tec_access_token')?.value;
    if (!token || token.trim() === '') {
      const loginUrl = new URL('/', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Unsafe method → CSRF (double-submit OR first-party origin) ────────
  if (!CSRF_SAFE_METHODS.has(method)) {
    const isCsrfProtected = CSRF_PROTECTED.some(r => pathname.startsWith(r));
    if (isCsrfProtected && !isTrustedCsrf(req)) {
      return NextResponse.json(
        { error: 'Invalid CSRF token', code: 'CSRF_INVALID' },
        { status: 403 },
      );
    }
    return NextResponse.next();
  }

  // ── Safe method → ensure a tec_csrf cookie exists ──────────
  // Self-mints the double-submit token on any page load. Per-origin —
  // no cross-domain cookie sharing required (apps are on separate domains).
  const res = NextResponse.next();
  if (!req.cookies.get('tec_csrf')?.value) {
    res.cookies.set('tec_csrf', crypto.randomUUID(), CSRF_COOKIE_OPTS);
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
