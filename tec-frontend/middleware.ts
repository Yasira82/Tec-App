import { NextRequest, NextResponse } from 'next/server';

// ── Public pages — لا تحتاج login ──────────────────────
const PUBLIC_PAGES = ['/', '/ai', '/opengraph-image'];

// ── Protected pages — تحتاج tec_access_token ──────────
const PROTECTED_PAGES = ['/hub', '/dashboard', '/dashboard/'];

// ── Public API routes — لا تحتاج token ─────────────────
const PUBLIC_PATHS = [
  '/api/auth/pi-login',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/health',
];

// ── CSRF protected API routes ────────────────────────────
const CSRF_PROTECTED = [
  '/api/payment/',
  '/api/wallet/',
  '/api/commerce/',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ua = req.headers.get('user-agent') ?? '';
  const isPiBrowser = ua.includes('PiBrowser') || ua.includes('Pi Network');

  // ── 1. Page protection — redirect بدون cookie ─────────
  const isProtectedPage = PROTECTED_PAGES.some((p) =>
    pathname === p || pathname.startsWith(p + '/') || (p.endsWith('/') && pathname.startsWith(p))
  );

  if (isProtectedPage) {
    const token = req.cookies.get('tec_access_token')?.value;
    if (!token) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/';
      loginUrl.search = '';
      return NextResponse.redirect(loginUrl);
    }
  }

  // ��─ 2. CSRF check (POST/PUT/PATCH/DELETE only) ─────────
  const needsCsrf = CSRF_PROTECTED.some((p) => pathname.startsWith(p));
  const csrfCookie = req.cookies.get('tec_csrf')?.value;

  if (needsCsrf && csrfCookie && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const headerCsrf = req.headers.get('x-csrf-token');
    if (!headerCsrf || headerCsrf !== csrfCookie) {
      return NextResponse.json(
        { success: false, error: { code: 'CSRF_INVALID', message: 'Invalid CSRF token' } },
        { status: 403 },
      );
    }
  }

  // ── 3. Inject Authorization header into API requests ───
  const requestHeaders = new Headers(req.headers);

  const isPublicApi = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (!isPublicApi && pathname.startsWith('/api/')) {
    const token = req.cookies.get('tec_access_token')?.value;
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  // ── 4. Continue ─────────────────────────────────────────
  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });

  res.headers.set('x-pi-browser', isPiBrowser ? 'true' : 'false');

  return res;
}

export const config = {
  matcher: [
    '/hub',
    '/hub/:path*',
    '/dashboard',
    '/dashboard/:path*',
    '/api/:path*',
  ],
};
