import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accessToken } = body;

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

    const isProd    = process.env.NODE_ENV === 'production';
    const maxAge    = 60 * 60 * 24;        // 24h
    const refreshAge = 60 * 60 * 24 * 7;  // 7d

    // ✅ Access token → HttpOnly cookie
    res.cookies.set('tec_access_token', data.tokens.accessToken, {
      httpOnly: true,
      secure:   isProd,
      sameSite: 'strict',
      maxAge,
      path:     '/',
    });

    // ✅ Refresh token → HttpOnly cookie
    res.cookies.set('tec_refresh_token', data.tokens.refreshToken, {
      httpOnly: true,
      secure:   isProd,
      sameSite: 'strict',
      maxAge:   refreshAge,
      path:     '/',
    });

    // ✅ User info → readable cookie (not HttpOnly — UI needs it)
    res.cookies.set('tec_user', JSON.stringify(data.user), {
      httpOnly: false,
      secure:   isProd,
      sameSite: 'strict',
      maxAge,
      path:     '/',
    });

    return res;
  } catch (err) {
    console.error('[pi-login] Error:', err);
    return NextResponse.json({ error: 'Auth failed' }, { status: 500 });
  }
}
