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
        Authorization:  `Bearer ${refreshToken}`,
      },
    });

    const data = await backendRes.json().catch(() => ({}));

    console.log('[refresh] gateway status:', backendRes.status);
    console.log('[refresh] gateway data keys:', Object.keys(data));

    if (!backendRes.ok) {
      return NextResponse.json(data, { status: backendRes.status });
    }

    // ✅ الـ token ممكن يكون في مكانين مختلفين
    const newAccessToken  = data.token ?? data.accessToken ?? data.data?.token ?? data.data?.accessToken ?? null;
    const newRefreshToken = data.refreshToken ?? data.data?.refreshToken ?? null;

    if (!newAccessToken) {
      console.error('[refresh] No access token in response:', JSON.stringify(data));
      return NextResponse.json({ error: 'No token in response' }, { status: 502 });
    }

    const res = NextResponse.json({ token: newAccessToken });

    res.cookies.set('tec_access_token', newAccessToken, {
      httpOnly: false,
      secure:   true,
      sameSite: 'none',
      maxAge:   60 * 60 * 24,
      path:     '/',
    });

    if (newRefreshToken) {
      res.cookies.set('tec_refresh_token', newRefreshToken, {
        httpOnly: true,
        secure:   true,
        sameSite: 'none',
        maxAge:   60 * 60 * 24 * 7,
        path:     '/',
      });
    }

    return res;
  } catch (err) {
    console.error('[refresh] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
