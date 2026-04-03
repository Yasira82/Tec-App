import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function POST(req: NextRequest) {
  try {
    // 1. استخراج الـ Refresh Token من الكوكيز
    const refreshToken = req.cookies.get('tec_refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: 'No refresh token found' }, { status: 401 });
    }

    // 2. إرسال الطلب للباك اند (API Gateway) لتجديد التوكن
    const backendRes = await fetch(`${GATEWAY}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refreshToken}`, // الباك اند يتوقعه في الـ Header
      },
    });

    const data = await backendRes.json();

    // إذا فشل التجديد (مثلاً التوكن منتهي الصلاحية أو تم حظره)
    if (!backendRes.ok) {
      return NextResponse.json(data, { status: backendRes.status });
    }

    // 3. تجهيز الرد بالتوكن الجديد
    const res = NextResponse.json({ token: data.token });

    const maxAge = 60 * 60 * 24; // 24 ساعة (نفس مدة الـ Login)

    // 4. تحديث الـ Cookie الخاص بالـ Access Token بالتوكن الجديد
    // ⚠️ مهم جداً: sameSite: 'none' و secure: true ليعمل داخل Pi Browser
    res.cookies.set('tec_access_token', data.token, {
      httpOnly: true,
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
