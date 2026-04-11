import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib-client/pi/pi-auth';

const PROTECTED_ROUTES = ['/hub', '/dashboard', '/profile', '/settings'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_ROUTES.some(route =>
    pathname.startsWith(route)
  );

  if (!isProtected) return NextResponse.next();

  // ✅ P1-13: تحقق من الـ cookie
  const token = req.cookies.get('tec_access_token')?.value;

  if (!token) {
    const loginUrl = new URL('/', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/hub/:path*',
    '/dashboard/:path*',
    '/profile/:path*',
    '/settings/:path*',
  ],
};
