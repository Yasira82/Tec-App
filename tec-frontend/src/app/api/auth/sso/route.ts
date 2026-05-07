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
  const isAllowed = target && ALLOWED_TARGETS.some(t => target.startsWith(t));
  if (!target || !isAllowed) {
    return NextResponse.json({ error: 'invalid_target' }, { status: 400 });
  }

  const secret    = process.env.SSO_SECRET;
  const jwtSecret = process.env.JWT_SECRET;
  if (!secret || !jwtSecret) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  try {
    const user = JSON.parse(decodeURIComponent(userCookie));

    // ✅ تحقق من الـ token — لو expired اعمل refresh
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

    // ✅ الـ audience = الـ target app base URL
    const targetBase = ALLOWED_TARGETS.find(t => target.startsWith(t)) ?? target;

    const jti     = crypto.randomUUID();
    const encoded = new TextEncoder().encode(secret);

    const token = await new SignJWT({ accessToken: validToken, user })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer('tec.pi')
      .setAudience(targetBase) // ✅ الـ audience الصح
      .setJti(jti)
      .setExpirationTime('5m')
      .setIssuedAt()
      .sign(encoded);

    // ✅ ابعت لـ sso-callback مع الـ token
    const redirectUrl = `${targetBase}/api/auth/sso-callback?token=${encodeURIComponent(token)}`;
    return NextResponse.redirect(redirectUrl);
  } catch {
    return NextResponse.json({ error: 'sso_failed' }, { status: 500 });
  }
}
