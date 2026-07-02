import { NextRequest, NextResponse } from 'next/server';
import { randomUUID }                from 'crypto';
import { SignJWT }                   from 'jose';
import { fetchWithTimeout }          from '@/lib/server/fetch-with-timeout';

const GATEWAY = process.env.API_GATEWAY_URL ?? '';

// Audiences accepted by our own /api/auth/sso-callback.
const SELF_AUDIENCES = [
  'https://tec-app-frontend.vercel.app',
  'https://hub.tecosystem.app',
];

// Pi Browser doesn't reliably persist cookies set on XHR responses — but it
// DOES persist cookies set on a top-level navigation (the SSO callback path,
// proven in production). So alongside the cookies below, we hand the client a
// one-time signed token; it finishes login by NAVIGATING to
// /api/auth/sso-callback?token=…, which re-sets the same cookies on a
// navigation response. Replay-safe via the callback's jti tracking.
async function mintSelfSsoToken(
  origin: string,
  accessToken: string,
  refreshToken: string,
  user: unknown,
): Promise<string | null> {
  const secret = process.env.SSO_SECRET;
  if (!secret) return null;
  const audience = SELF_AUDIENCES.includes(origin) ? origin : SELF_AUDIENCES[1];
  try {
    return await new SignJWT({ accessToken, refreshToken, user })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject((user as { id?: string })?.id ?? 'unknown')
      .setIssuer('tec.pi')
      .setAudience(audience)
      .setJti(randomUUID())
      .setExpirationTime('5m')
      .setIssuedAt()
      .sign(new TextEncoder().encode(secret));
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accessToken } = body;

    if (!accessToken) {
      return NextResponse.json({ error: 'Missing accessToken' }, { status: 400 });
    }

    let backendRes: Response;
    try {
      backendRes = await fetchWithTimeout(
        `${GATEWAY}/api/v1/auth/pi-login`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ accessToken }),
        },
        25000,
      );
    } catch (timeoutErr) {
      console.error('[pi-login] Gateway timeout:', timeoutErr);
      return NextResponse.json(
        { error: 'Auth service timeout — please try again' },
        { status: 504 },
      );
    }

    const data = await backendRes.json().catch(() => ({}));

    if (!backendRes.ok) {
      return NextResponse.json(data, { status: backendRes.status });
    }

    if (!data.tokens?.accessToken || !data.tokens?.refreshToken) {
      console.error('[pi-login] Missing tokens in backend response');
      return NextResponse.json({ error: 'Invalid backend response' }, { status: 502 });
    }

    const ssoToken = await mintSelfSsoToken(
      req.nextUrl.origin,
      data.tokens.accessToken,
      data.tokens.refreshToken,
      data.user,
    );

    const res = NextResponse.json({
      success:   data.success,
      isNewUser: data.isNewUser,
      user:      data.user,
      // In-memory session transport (C-123 §7): the client holds this token in
      // memory and sends it as an Authorization header — the cookie-independent
      // path. Same exposure as the non-httpOnly cookie + ssoToken below.
      accessToken: data.tokens.accessToken,
      ...(ssoToken ? { ssoToken } : {}),
    });

    const maxAge     = 60 * 60 * 24;
    const refreshAge = 60 * 60 * 24 * 7;

    // sameSite:'none' + secure — REQUIRED (Runtime Verified, July 2026).
    // Pi Browser can load the app in an embedded/webview context where 'lax'
    // cookies are neither stored nor sent (even document.cookie writes are
    // ignored) → /hub bounced to login in a loop. 'none' is the original
    // platform contract and works in both top-level and embedded contexts.
    // Do NOT change to 'lax' again — that caused the July 2026 login outage.
    res.cookies.set('tec_access_token', data.tokens.accessToken, {
      httpOnly: false,
      secure:   true,
      sameSite: 'none',
      partitioned: true,
      maxAge,
      path:     '/',
    });

    res.cookies.set('tec_refresh_token', data.tokens.refreshToken, {
      httpOnly: true,
      secure:   true,
      sameSite: 'none',
      partitioned: true,
      maxAge:   refreshAge,
      path:     '/',
    });

    res.cookies.set('tec_user', JSON.stringify(data.user), {
      httpOnly: false,
      secure:   true,
      sameSite: 'none',
      partitioned: true,
      maxAge,
      path:     '/',
    });

    res.cookies.set('tec_csrf', randomUUID(), {
      httpOnly: false,
      secure:   true,
      sameSite: 'none',
      partitioned: true,
      maxAge,
      path:     '/',
    });

    return res;
  } catch (err) {
    console.error('[pi-login] Error:', err);
    return NextResponse.json({ error: 'Auth failed' }, { status: 500 });
  }
}
