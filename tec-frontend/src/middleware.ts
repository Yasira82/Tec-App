import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const ua          = req.headers.get('user-agent') ?? '';
  const isPiBrowser = ua.includes('PiBrowser') || ua.includes('Pi Network');

  const res = NextResponse.next();
  res.headers.set('x-pi-browser', isPiBrowser ? 'true' : 'false');
  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
