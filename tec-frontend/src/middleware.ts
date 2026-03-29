import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const ua        = req.headers.get('user-agent') ?? '';
  const pathname  = req.nextUrl.pathname;
  const isPiBrowser = ua.includes('PiBrowser') || ua.includes('Pi Network');

  // ── Protected routes — redirect to login if no token ──────
  const protectedRoutes = ['/hub', '/dashboard'];
  const isProtected = protectedRoutes.some(r => pathname.startsWith(r));

  const token = req.cookies.get('tec_access_token')?.value
    ?? req.headers.get('authorization')?.replace('Bearer ', '');

  if (isProtected && !token) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/';
    return NextResponse.redirect(loginUrl);
  }

  // ── Pi Browser warning header ──────────────────────────────
  const res = NextResponse.next();
  res.headers.set('x-pi-browser', isPiBrowser ? 'true' : 'false');
  return res;
}

export const config = {
  matcher: [
    '/hub/:path*',
    '/dashboard/:path*',
    '/api/:path*',
  ],
};
