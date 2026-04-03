import { NextRequest, NextResponse } from 'next/server';

// ✅ هذه الـ routes مش محتاجة token
const PUBLIC_PATHS = [
  '/api/auth/pi-login',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/health',
];

export function middleware(req: NextRequest) {
  const ua          = req.headers.get('user-agent') ?? '';
  const isPiBrowser = ua.includes('PiBrowser') || ua.includes('Pi Network');

  const res = NextResponse.next();
  res.headers.set('x-pi-browser', isPiBrowser ? 'true' : 'false');

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
