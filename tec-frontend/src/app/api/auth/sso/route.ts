import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify }        from 'jose';

const ALLOWED_TARGETS = [
  'https://tec-assets-app.vercel.app',
  'https://tec-assets.vercel.app',
  'https://assets.tecosystem.app',
  'https://assets.pi',
  'https://tec-commerce-app.vercel.app',
  'https://commerce.tecosystem.app',
  'https://commerce.pi',
];

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get('tec_access_token')?.value;
  const userCookie  = req.cookies.get('tec_user')?.value;

  if (!accessToken || !userCookie) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  const target = req.nextUrl.searchParams.get('target');

  // ✅ الـ target لازم يبدأ بـ allowed base
  const targetBase = ALLOWED_TARGETS.find(t => target?.startsWith(t));
  if (!target || !targetBase) {
    return NextResponse.json({ error: 'invalid_target' }, { status: 400 });
  }

  const secret    = process.env.SSO_SECRET;
  const jwtSecret = process.env.JWT_SECRET;
  if (!secret || !jwtSecret) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  try {
    const user = JSON.parse(decodeURIComponent(userCookie));

    let validToken = accessToken;
    try {
      const encoded = new TextEncoder().encode(jwtSecret);
      await jwtVerify(accessToken, encoded, { algorithms: ['HS256'] });
    } catch {
      const csrfToken  = req.cookies.get('tec_csrf')?.value ?? '';
      const refreshRes = await fetch(`${req.nextUrl.origin}/api/auth/refresh`, {
        method:  'POST',
        headers: {
          Cookie:         req.headers.get('cookie') ?? '',
          'x-csrf-token': csrfToken,
          'Content-Type': 'application/json',
        },
      });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        validToken = refreshData.token ?? accessToken;
      }
    }

    const jti     = crypto.randomUUID();
    const encoded = new TextEncoder().encode(secret);

    const token = await new SignJWT({ accessToken: validToken, user })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer('tec.pi')
      .setAudience(targetBase) // ✅ الـ audience = الـ base URL
      .setJti(jti)
      .setExpirationTime('5m')
      .setIssuedAt()
      .sign(encoded);

    // ✅ ابعت لـ sso-callback على نفس الـ targetBase
    const redirectUrl = `${targetBase}/api/auth/sso-callback?token=${encodeURIComponent(token)}`;
    return NextResponse.redirect(redirectUrl);
  } catch {
    return NextResponse.json({ error: 'sso_failed' }, { status: 500 });
  }
}
