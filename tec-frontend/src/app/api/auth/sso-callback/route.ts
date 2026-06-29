import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify }                 from 'jose';

const ALLOWED_AUDIENCES = [
  'https://tec-app-frontend.vercel.app',
  'https://hub.tecosystem.app',
];

const usedJtis = new Map<string, number>();

const isJtiUsed = (jti: string): boolean => {
  const now = Date.now();
  for (const [key, exp] of usedJtis) {
    if (now > exp) usedJtis.delete(key);
  }
  return usedJtis.has(jti);
};

const markJtiUsed = (jti: string): void => {
  usedJtis.set(jti, Date.now() + 5 * 60 * 1000);
};

export async function GET(req: NextRequest) {
  const token    = req.nextUrl.searchParams.get('token');
  const rawRedirect = req.nextUrl.searchParams.get('redirect') ?? '/hub';
  // Block open redirect: only same-origin absolute paths (no //host, no scheme)
  const redirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/hub';

  if (!token) return NextResponse.redirect(new URL('/hub', req.url));

  const secret = process.env.SSO_SECRET;
  if (!secret) return NextResponse.json({ error: 'sso_not_configured' }, { status: 503 });

  let payload: Record<string, unknown> | null = null;
  const encoded = new TextEncoder().encode(secret);

  for (const audience of ALLOWED_AUDIENCES) {
    try {
      const result = await jwtVerify(
        decodeURIComponent(token),
        encoded,
        { algorithms: ['HS256'], issuer: 'tec.pi', audience },
      );
      payload = result.payload as Record<string, unknown>;
      break;
    } catch { /* جرب التالي */ }
  }

  if (!payload) return NextResponse.redirect(new URL('/', req.url));

  const jti = payload.jti as string;
  if (!jti)           return NextResponse.json({ error: 'missing_jti' },     { status: 401 });
  if (isJtiUsed(jti)) return NextResponse.json({ error: 'replay_detected' }, { status: 401 });
  markJtiUsed(jti);

  const accessToken = payload.accessToken as string;
  const user        = payload.user as Record<string, unknown>;

  // ✅ روح لـ redirect path بعد الـ SSO
  const res = NextResponse.redirect(new URL(redirect, req.url));

  // sameSite:'lax' (NOT 'none'): Pi Browser drops sameSite=None cookies. The SSO
  // token arrives in the URL and we set first-party cookies on a top-level
  // redirect to /hub, so 'lax' is sent correctly and reliably in Pi Browser.
  const cookieOpts = {
    httpOnly: false,
    secure:   true,
    sameSite: 'lax' as const,
    path:     '/',
    maxAge:   60 * 60 * 24,
  };

  res.cookies.set('tec_access_token', accessToken,          cookieOpts);
  res.cookies.set('tec_user',         JSON.stringify(user), cookieOpts);
  res.cookies.set('tec_csrf',         crypto.randomUUID(),  cookieOpts);

  return res;
}
