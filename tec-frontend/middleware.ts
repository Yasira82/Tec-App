import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/api/auth/pi-login',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/health',
];

const CSRF_PROTECTED = [
  '/api/payment/',
  '/api/wallet/',
  '/api/commerce/',
];

export function middleware(req: NextRequest) {
  const ua = req.headers.get('user-agent') ?? '';
  const isPiBrowser = ua.includes('PiBrowser') || ua.includes('Pi Network');

  // 1. حماية CSRF للطلبات التي تغير الحالة
  const needsCsrf = CSRF_PROTECTED.some(p => req.nextUrl.pathname.startsWith(p));
  const csrfCookie = req.cookies.get('tec_csrf')?.value;

  if (needsCsrf && csrfCookie && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const headerCsrf = req.headers.get('x-csrf-token');
    if (!headerCsrf || csrfCookie !== headerCsrf) {
      return NextResponse.json(
        { success: false, error: { code: 'CSRF_INVALID', message: 'Invalid CSRF token' } },
        { status: 403 }
      );
    }
  }

  // 2. تجهيز الـ Headers الجديدة للـ Request
  const requestHeaders = new Headers(req.headers);
  
  // 3. حقن الـ Authorization Header من الكوكي
  const isPublic = PUBLIC_PATHS.some(p => req.nextUrl.pathname.startsWith(p));
  if (!isPublic && req.nextUrl.pathname.startsWith('/api/')) {
    const token = req.cookies.get('tec_access_token')?.value;
    if (token) {
      // ✅ التعديل الأهم: وضع التوكن في الـ Request عشان الـ Route يشوفه
      requestHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  // 4. تمرير الـ Request بالـ Headers الجديدة
  const res = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // 5. وضع الـ Headers على الـ Response
  res.headers.set('x-pi-browser', isPiBrowser ? 'true' : 'false');

  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
