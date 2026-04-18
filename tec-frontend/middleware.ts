import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_ROUTES = ['/hub', '/dashboard', '/profile', '/settings'];
const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_PROTECTED = [
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/wallet',
  '/api/payment',
  '/api/payments',
  '/api/kyc',
  '/api/notifications',
  '/api/assets',
  '/api/marketplace',
  '/api/commerce',
  '/api/subscriptions',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();

  // ── Page protection ────────────────────────────────────────
  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  if (isProtected) {
    const token = req.cookies.get('tec_access_token')?.value;
    if (!token || token.trim() === '') {
      const loginUrl = new URL('/', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── CSRF verification — double-submit pattern ──────────────
  if (!CSRF_SAFE_METHODS.has(method)) {
    const isCsrfProtected = CSRF_PROTECTED.some((r) => pathname.startsWith(r));
    if (isCsrfProtected) {
      const csrfCookie = req.cookies.get('tec_csrf')?.value;
      const csrfHeader = req.headers.get('x-csrf-token');

      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        return NextResponse.json(
          { error: 'Invalid CSRF token', code: 'CSRF_INVALID' },
          { status: 403 }
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/hub/:path*',
    '/dashboard/:path*',
    '/profile/:path*',
    '/settings/:path*',
    '/api/auth/logout',
    '/api/auth/refresh',
    '/api/wallet/:path*',
    '/api/payment/:path*',
    '/api/payments/:path*',
    '/api/kyc/:path*',
    '/api/notifications/:path*',
    '/api/assets/:path*',
    '/api/marketplace/:path*',
    '/api/commerce/:path*',
    '/api/subscriptions/:path*',
  ],
};
