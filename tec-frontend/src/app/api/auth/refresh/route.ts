import { NextRequest, NextResponse } from 'next/server';
import { randomUUID }                from 'crypto';

const GATEWAY = process.env.API_GATEWAY_URL ?? process.env.API_GATEWAY_URL!;

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
        Authorization:  `Bearer ${refreshToken}`,
      },
    });

    const data = await backendRes.json().catch(() => ({}));

    if (!backendRes.ok) {
      return NextResponse.json(data, { status: backendRes.status });
    }

    const newAccessToken  = data.token ?? data.accessToken ?? data.data?.token ?? data.data?.accessToken ?? null;
    const newRefreshToken = data.refreshToken ?? data.data?.refreshToken ?? null;

    if (!newAccessToken) {
      console.error('[refresh] No access token in response:', JSON.stringify(data));
      return NextResponse.json({ error: 'No token in response' }, { status: 502 });
    }

    // ✅ جدد الـ CSRF مع كل refresh
    const newCsrf = randomUUID();

    const cookieOpts = {
      secure:   true,
      sameSite: 'none' as const,
      path:     '/',
    };

    const res = NextResponse.json({ token: newAccessToken });

    res.cookies.set('tec_access_token', newAccessToken, {
      ...cookieOpts,
      httpOnly: false,
      maxAge:   60 * 60 * 24,
    });

    res.cookies.set('tec_csrf', newCsrf, {
      ...cookieOpts,
      httpOnly: false,
      maxAge:   60 * 60 * 24,
    });

    if (newRefreshToken) {
      res.cookies.set('tec_refresh_token', newRefreshToken, {
        ...cookieOpts,
        httpOnly: true,
        maxAge:   60 * 60 * 24 * 7,
      });
    }

    return res;
  } catch (err) {
    console.error('[refresh] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
