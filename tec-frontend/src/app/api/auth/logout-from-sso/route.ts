import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/', req.url));

  // 'none' to match the session cookies exactly so the clearing cookie deletes them.
  const cookieBase = {
    httpOnly: false,
    secure:   true,
    sameSite: 'none' as const,
    partitioned: true,
    path:     '/',
    maxAge:   0,
  };

  res.cookies.set('tec_access_token', '', cookieBase);
  res.cookies.set('tec_user',         '', cookieBase);
  res.cookies.set('tec_csrf',         '', cookieBase);

  return res;
}
