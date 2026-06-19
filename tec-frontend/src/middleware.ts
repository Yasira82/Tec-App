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

  // ── CSRF verification ──────────────────────────────────────
  if (!CSRF_SAFE_METHODS.has(method)) {
    const isCsrfProtected = CSRF_PROTECTED.some(r => pathname.startsWith(r));
    if (isCsrfProtected) {
      const csrfCookie = req.cookies.get('tec_csrf')?.value ?? '';
      const csrfHeader = req.headers.get('x-csrf-token') ?? '';
      if (csrfCookie && !timingSafeStringEqual(csrfCookie, csrfHeader)) {
        return NextResponse.json(
          { error: 'Invalid CSRF token', code: 'CSRF_INVALID' },
          { status: 403 },
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
    '/api/kyc/:path*',
    '/api/notifications/:path*',
    '/api/assets/:path*',
    '/api/marketplace/:path*',
    '/api/commerce/:path*',
    '/api/subscriptions/:path*',
    '/api/payment/:path*',
    '/api/admin/:path*',
    '/api/ai/:path*',
    '/api/identity/:path*',
    '/api/bff/payment/:path*',
    '/api/bff/assets/:path*',
    '/api/bff/commerce/:path*',
    '/api/bff/identity/:path*',
    '/api/bff/notifications/:path*',
  ],
};
