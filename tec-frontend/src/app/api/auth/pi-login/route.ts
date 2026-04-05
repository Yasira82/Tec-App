import { NextRequest, NextResponse } from 'next/server';
import { randomUUID }                from 'crypto';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accessToken, csrfToken } = body;

    if (!accessToken) {
      return NextResponse.json({ error: 'Missing accessToken' }, { status: 400 });
    }

    const backendRes = await fetch(`${GATEWAY}/api/v1/auth/pi-login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ accessToken }),
    });

    const data = await backendRes.json();

    if (!backendRes.ok) {
      return NextResponse.json(data, { status: backendRes.status });
    }

    const res = NextResponse.json({
      success:   data.success,
      isNewUser: data.isNewUser,
      user:      data.user,
    });

    const maxAge     = 60 * 60 * 24;
    const refreshAge = 60 * 60 * 24 * 7;

    // ✅ sameSite: 'none' ضروري للـ Pi Browser WebView
    res.cookies.set('tec_access_token', data.tokens.accessToken, {
      httpOnly: true,
      secure:   true,
      sameSite: 'none',
      maxAge,
      path:     '/',
    });

    res.cookies.set('tec_refresh_token', data.tokens.refreshToken, {
      httpOnly: true,
      secure:   true,
      sameSite: 'none',
      maxAge:   refreshAge,
      path:     '/',
    });

    res.cookies.set('tec_user', JSON.stringify(data.user), {
      httpOnly: false,
      secure:   true,
      sameSite: 'none',
      maxAge,
      path:     '/',
    });

    // ✅ CSRF double-submit token — يعوّض عن sameSite: 'none'
    const csrf = randomUUID();
    res.cookies.set('tec_csrf', csrf, {
      httpOnly: false, // readable من JS عشان نبعته في الـ header
      secure:   true,
      sameSite: 'none',
      maxAge,
      path:     '/',
    });

    return res;
  } catch (err) {
    console.error('[pi-login] Error:', err);
    return NextResponse.json({ error: 'Auth failed' }, { status: 500 });
  }
}
