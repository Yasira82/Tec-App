import { NextRequest, NextResponse } from 'next/server';
import { randomUUID }                from 'crypto';
import { fetchWithTimeout }          from '@/lib/server/fetch-with-timeout';

const GATEWAY = process.env.API_GATEWAY_URL ?? '';

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

    const res = NextResponse.json({
      success:   data.success,
      isNewUser: data.isNewUser,
      user:      data.user,
    });

    const maxAge     = 60 * 60 * 24;
    const refreshAge = 60 * 60 * 24 * 7;

    // sameSite:'lax' (NOT 'none'): Pi Browser drops sameSite=None cookies, which
    // broke the /hub session (login succeeded but /hub saw no tec_user → bounced
    // to login in a loop). These are first-party Hub cookies — only read by
    // hub.tecosystem.app and its same-origin /api/* routes — so 'lax' is correct
    // and is sent on the top-level navigation to /hub. SSO is unaffected (token
    // travels in the URL to the target app, not via a cross-domain cookie).
    res.cookies.set('tec_access_token', data.tokens.accessToken, {
      httpOnly: false,
      secure:   true,
      sameSite: 'lax',
      maxAge,
      path:     '/',
    });

    res.cookies.set('tec_refresh_token', data.tokens.refreshToken, {
      httpOnly: true,
      secure:   true,
      sameSite: 'lax',
      maxAge:   refreshAge,
      path:     '/',
    });

    res.cookies.set('tec_user', JSON.stringify(data.user), {
      httpOnly: false,
      secure:   true,
      sameSite: 'lax',
      maxAge,
      path:     '/',
    });

    res.cookies.set('tec_csrf', randomUUID(), {
      httpOnly: false,
      secure:   true,
      sameSite: 'lax',
      maxAge,
      path:     '/',
    });

    return res;
  } catch (err) {
    console.error('[pi-login] Error:', err);
    return NextResponse.json({ error: 'Auth failed' }, { status: 500 });
  }
}
