import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';

const ALLOWED_TARGETS = [
  'https://tec-assets.vercel.app',
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

  const secret = process.env.SSO_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'sso_not_configured' }, { status: 503 });
  }

  try {
    const user    = JSON.parse(decodeURIComponent(userCookie));
    const jti     = crypto.randomUUID();
    const encoded = new TextEncoder().encode(secret);

    const token = await new SignJWT({ accessToken, user })
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

  } catch {
    return NextResponse.json({ error: 'sso_failed' }, { status: 500 });
  }
}
