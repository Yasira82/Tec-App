import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify }        from 'jose';

const ALLOWED_TARGETS = [
  'https://tec-assets-app.vercel.app',
  'https://assets.pi',
];

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get('tec_access_token')?.value;
  const userCookie  = req.cookies.get('tec_user')?.value;

  if (!accessToken || !userCookie) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  const target = req.nextUrl.searchParams.get('target');
  if (!target || !ALLOWED_TARGETS.includes(target)) {
    return NextResponse.json({ error: 'invalid_target' }, { status: 400 });
  }

  const ssoSecret = process.env.SSO_SECRET;
  const jwtSecret = process.env.JWT_SECRET;
  if (!ssoSecret || !jwtSecret) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  try {
    const user = JSON.parse(decodeURIComponent(userCookie));

    // ✅ تحقق من الـ token — لو expired ابعت الـ userId بس
    let validToken = accessToken;
    try {
      const encoded = new TextEncoder().encode(jwtSecret);
      await jwtVerify(accessToken, encoded, { algorithms: ['HS256'] });
    } catch {
      // ✅ Token expired — اعمل fresh token للـ SSO
      console.log('[SSO] access token expired — generating fresh token');
      const encoded   = new TextEncoder().encode(jwtSecret);
      validToken = await new SignJWT({
        sub:         user.id,
        role:        user.role,
        piUsername:  user.piUsername,
        kycVerified: user.kycVerified ?? false,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(user.id)
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(encoded);
    }

    // ✅ ابني الـ SSO token بالـ valid access token
    const jti     = crypto.randomUUID();
    const encoded = new TextEncoder().encode(ssoSecret);

    const token = await new SignJWT({
      accessToken: validToken,
      user,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer('tec.pi')
      .setAudience(target)
      .setJti(jti)
      .setExpirationTime('5m')
      .setIssuedAt()
      .sign(encoded);

    const redirectUrl = `${target}/api/auth/sso-callback?token=${encodeURIComponent(token)}`;
    return NextResponse.redirect(redirectUrl);

  } catch (err) {
    console.error('[SSO] error:', (err as Error).message);
    return NextResponse.json({ error: 'sso_failed' }, { status: 500 });
  }
}
