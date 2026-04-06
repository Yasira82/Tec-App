import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/api/auth/pi-login',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/health',
];

// CSRF protection for state-changing endpoints
// Applies ONLY when tec_csrf cookie exists (browser session).
const CSRF_PROTECTED = [
  '/api/payment/',
  '/api/wallet/',
  '/api/commerce/',
];

export function middleware(req: NextRequest) {
  const ua = req.headers.get('user-agent') ?? '';
  const isPiBrowser = ua.includes('PiBrowser') || ua.includes('Pi Network');

  // ----- CSRF check (only for POST/PUT/PATCH/DELETE) -----
  const needsCsrf = CSRF_PROTECTED.some((p) => req.nextUrl.pathname.startsWith(p));
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

  // ----- Inject Authorization header into the *REQUEST* -----
  const requestHeaders = new Headers(req.headers);

  const isPublic = PUBLIC_PATHS.some((p) => req.nextUrl.pathname.startsWith(p));
  if (!isPublic && req.nextUrl.pathname.startsWith('/api/')) {
    const token = req.cookies.get('tec_access_token')?.value;
    if (token) {
      // ✅ IMPORTANT: Inject into request headers, not response headers
      requestHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  // Continue request with mutated headers
  const res = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Add debug/info header on the response
  res.headers.set('x-pi-browser', isPiBrowser ? 'true' : 'false');

  // Optional: useful for debugging cookie issues (can remove later)
  // res.headers.set('x-has-tec-token', req.cookies.get('tec_access_token')?.value ? 'true' : 'false');

  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
