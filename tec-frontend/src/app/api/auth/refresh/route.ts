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
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${refreshToken}`,
      },
    });

    const data = await backendRes.json();

    if (!backendRes.ok) {
      return NextResponse.json(data, { status: backendRes.status });
    }

    const res    = NextResponse.json({ token: data.token });
    const maxAge = 60 * 60 * 24;

    // ✅ P0-1: httpOnly: false — يجب أن يتطابق مع pi-login/route.ts
    // Pi Browser يقرأ الـ token من document.cookie
    // الـ httpOnly: true القديم كان يكسر auth بعد أول refresh
    res.cookies.set('tec_access_token', data.token, {
      httpOnly: false,
      secure:   true,
      sameSite: 'none',
      maxAge,
      path:     '/',
    });

    return res;
  } catch (err) {
    console.error('[refresh-token] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
