import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/api/auth/pi-login',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/health',
];

// CSRF protection applies only when `tec_csrf` cookie is present
// (i.e. a browser-authenticated user). Server-to-server calls skip this.
const CSRF_PROTECTED = [
  '/api/payment/',
  '/api/wallet/',
  '/api/commerce/',
];

export function middleware(req: NextRequest) {
  const ua          = req.headers.get('user-agent') ?? '';
  const isPiBrowser = ua.includes('PiBrowser') || ua.includes('Pi Network');

  // ── CSRF double-submit check ───────────────────────────────────────────────
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

  // ── Authorization header injection ────────────────────────────────────────
  // Mutates *request* headers so API routes receive the Bearer token.
  const isPublic = PUBLIC_PATHS.some(p => req.nextUrl.pathname.startsWith(p));
  const token    = req.cookies.get('tec_access_token')?.value;

  let res: NextResponse;
  if (!isPublic && req.nextUrl.pathname.startsWith('/api/') && token) {
    const newHeaders = new Headers(req.headers);
    newHeaders.set('Authorization', `Bearer ${token}`);
    res = NextResponse.next({ request: { headers: newHeaders } });
  } else {
    res = NextResponse.next();
  }

  // ── Response headers (always) ─────────────────────────────────────────────
  res.headers.set('x-pi-browser',    isPiBrowser ? 'true' : 'false');
  res.headers.set('x-has-tec-token', token       ? 'true' : 'false'); // debug

  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
