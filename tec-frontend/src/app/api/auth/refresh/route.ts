import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get('tec_refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: 'No refresh token found' }, { status: 401 });
    }

    const backendRes = await fetch(`${GATEWAY}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshToken}`,
      },
    });

    const data = await backendRes.json().catch(() => ({}));

    if (!backendRes.ok) {
      return NextResponse.json(data, { status: backendRes.status });
    }

    const res = NextResponse.json({ token: data.token });
    const accessMaxAge = 60 * 60 * 24; // 24h
    const refreshMaxAge = 60 * 60 * 24 * 7; // 7d

    // ✅ P0-1: httpOnly:false — Pi Browser يقرأ من document.cookie
    res.cookies.set('tec_access_token', data.token, {
      httpOnly: false,
      secure: true,
      sameSite: 'none',
      maxAge: accessMaxAge,
      path: '/',
    });

    // ✅ P1-4: حط الـ refresh token الجديد في الـ cookie
    if (data.refreshToken) {
      res.cookies.set('tec_refresh_token', data.refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: refreshMaxAge,
        path: '/',
      });
    }

    return res;
  } catch (err) {
    console.error('[refresh-token] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
