import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify }        from 'jose';
import { ALLOWED_APP_ORIGINS as ALLOWED_TARGETS } from '@/domains/allowed-origins';


export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get('tec_access_token')?.value;
  const userCookie  = req.cookies.get('tec_user')?.value;

  if (!accessToken || !userCookie) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  const target = req.nextUrl.searchParams.get('target');

  const targetBase = ALLOWED_TARGETS.find(t => target?.startsWith(t));
  if (!target || !targetBase) {
    // Say WHAT was rejected. The bare `{"error":"invalid_target"}` sent the
    // next person hunting: an app whose real Vercel hostname carries a suffix
    // (`tec-zone-mu.vercel.app`, because `tec-zone` was taken) is not in the
    // list, and the response gave no way to know that from the screen.
    //
    // The target is the caller's OWN origin — echoing it reveals nothing they
    // did not send. The allowlist itself is NOT echoed: it is not a secret,
    // but there is no reason to hand an attacker the map.
    return NextResponse.json(
      {
        error: 'invalid_target',
        target,
        hint: 'This origin is not in the Hub SSO allowlist. Add the app\'s REAL '
            + 'host (Vercel appends a suffix when the project name is taken) to '
            + 'ALLOWED_TARGETS here and to the app\'s own ALLOWED_AUDIENCES. '
            + 'Never widen this to *.vercel.app — anyone can deploy there.',
      },
      { status: 400 },
    );
  }

  const secret    = process.env.SSO_SECRET;
  const jwtSecret = process.env.JWT_SECRET;
  if (!secret || !jwtSecret) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  try {
    const user = JSON.parse(decodeURIComponent(userCookie));

    let validToken = accessToken;
    // Rotated cookies from an internal refresh MUST be forwarded to the browser
    // — refresh tokens are single-use; dropping the rotation here silently
    // killed the session ("Refresh token already used" on the next refresh).
    let rotatedCookies: string[] = [];
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
        validToken     = refreshData.token ?? accessToken;
        rotatedCookies = refreshRes.headers?.getSetCookie?.() ?? [];
      }
    }

    const jti     = crypto.randomUUID();
    const encoded = new TextEncoder().encode(secret);

    const token = await new SignJWT({ accessToken: validToken, user })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer('tec.pi')
      .setAudience(targetBase)
      .setJti(jti)
      .setExpirationTime('5m')
      .setIssuedAt()
      .sign(encoded);

    const callbackUrl = new URL(`${targetBase}/api/auth/sso-callback`);
    callbackUrl.searchParams.set('token', token);

    const targetUrl   = new URL(target);
    const targetPath  = targetUrl.pathname + targetUrl.search;
    if (targetPath !== '/' && targetPath !== '') {
      callbackUrl.searchParams.set('redirect', targetPath);
    }

    const res = NextResponse.redirect(callbackUrl.toString());
    for (const c of rotatedCookies) res.headers.append('Set-Cookie', c);
    return res;
  } catch {
    return NextResponse.json({ error: 'sso_failed' }, { status: 500 });
  }
}
