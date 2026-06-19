import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_ROUTES  = ['/hub', '/dashboard', '/profile', '/settings'];
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
const CSRF_COOKIE_OPTS = {
  httpOnly: false,
  secure:   true,
  sameSite: 'none' as const,
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

  // ── Unsafe method → strict CSRF double-submit ──────────────
  // Safe to be strict: every safe-method request below self-mints the
  // tec_csrf cookie, so by the time a POST happens the cookie always exists.
  if (!CSRF_SAFE_METHODS.has(method)) {
    const isCsrfProtected = CSRF_PROTECTED.some(r => pathname.startsWith(r));
    if (isCsrfProtected) {
      const csrfCookie = req.cookies.get('tec_csrf')?.value ?? '';
      const csrfHeader = req.headers.get('x-csrf-token') ?? '';
      if (!csrfCookie || !csrfHeader || !timingSafeStringEqual(csrfCookie, csrfHeader)) {
        return NextResponse.json(
          { error: 'Invalid CSRF token', code: 'CSRF_INVALID' },
          { status: 403 },
        );
      }
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
