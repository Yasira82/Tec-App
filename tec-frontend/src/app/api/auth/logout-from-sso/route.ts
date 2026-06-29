import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/', req.url));

  // 'lax' to match the session cookies (Pi Browser drops sameSite=None) so the
  // clearing cookie lines up with what was set and deletes cleanly.
  const cookieBase = {
    httpOnly: false,
    secure:   true,
    sameSite: 'lax' as const,
    path:     '/',
    maxAge:   0,
  };

  res.cookies.set('tec_access_token', '', cookieBase);
  res.cookies.set('tec_user',         '', cookieBase);
  res.cookies.set('tec_csrf',         '', cookieBase);

  return res;
}
