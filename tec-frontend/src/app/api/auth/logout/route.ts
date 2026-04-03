import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ success: true });

  res.cookies.set('tec_access_token',  '', { maxAge: 0, path: '/' });
  res.cookies.set('tec_refresh_token', '', { maxAge: 0, path: '/' });
  res.cookies.set('tec_user',          '', { maxAge: 0, path: '/' });

  return res;
}
