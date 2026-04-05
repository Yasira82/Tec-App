import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/api/auth/pi-login',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/health',
];

// ✅ CSRF protection — بس لو في tec_csrf cookie
// لو مفيش cookie → الـ request مش من browser → skip
const CSRF_PROTECTED = [
  '/api/payment/',
  '/api/wallet/',
  '/api/commerce/',
];

export function middleware(req: NextRequest) {
  const ua          = req.headers.get('user-agent') ?? '';
  const isPiBrowser = ua.includes('PiBrowser') || ua.includes('Pi Network');

  const res = NextResponse.next();
  res.headers.set('x-pi-browser', isPiBrowser ? 'true' : 'false');

  // ✅ CSRF check — بس لو في tec_csrf cookie (يعني user logged in من browser)
  const needsCsrf  = CSRF_PROTECTED.some(p => req.nextUrl.pathname.startsWith(p));
  const csrfCookie = req.cookies.get('tec_csrf')?.value;

  if (needsCsrf && csrfCookie && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const headerCsrf = req.headers.get('x-csrf-token');
    if (!headerCsrf || csrfCookie !== headerCsrf) {
      return NextResponse.json(
        { success: false, error: { code: 'CSRF_INVALID', message: 'Invalid CSRF token' } },
        { status: 403 },
      );
    }
  }

  // ✅ inject token من cookie → Authorization header
  const isPublic = PUBLIC_PATHS.some(p => req.nextUrl.pathname.startsWith(p));
  if (!isPublic && req.nextUrl.pathname.startsWith('/api/')) {
    const token = req.cookies.get('tec_access_token')?.value;
    if (token) {
      const newHeaders = new Headers(req.headers);
      newHeaders.set('Authorization', `Bearer ${token}`);
      return NextResponse.next({ request: { headers: newHeaders } });
    }
  }

  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
