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
  const csrf        = crypto.randomUUID();

  // 200 HTML landing page — NOT a redirect. Production logs proved Pi Browser
  // drops Set-Cookie attached to 3xx responses (sso-callback 307 → /hub arrived
  // cookie-less → middleware bounced → login loop). Cookies on a 200 top-level
  // HTML response are the classic login path every browser honors. The inline
  // script then VERIFIES the session is server-visible (/api/auth/me) before
  // entering the app; if header cookies were still dropped, it rewrites the
  // non-httpOnly ones via document.cookie and re-verifies. We never navigate to
  // a protected page until the server has confirmed the session — no loop.
  const cookieOpts = {
    httpOnly: false,
    secure:   true,
    sameSite: 'none' as const,
    path:     '/',
    maxAge:   60 * 60 * 24,
  };

  // Embedded for the document.cookie fallback — these are the non-httpOnly
  // cookies, already JS-readable by design, and this page is one-time (jti).
  const jsCookies = [
    { name: 'tec_access_token', value: accessToken,          maxAge: 60 * 60 * 24 },
    { name: 'tec_user',         value: JSON.stringify(user), maxAge: 60 * 60 * 24 },
    { name: 'tec_csrf',         value: csrf,                 maxAge: 60 * 60 * 24 },
  ];
  const esc = (s: string) => s.replace(/</g, '\\u003c');

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>TEC — Signing in…</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<noscript><meta http-equiv="refresh" content="0;url=${redirect.replace(/"/g, '')}"></noscript>
</head>
<body style="margin:0;background:#050816;color:#FBBF24;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">
<div style="text-align:center"><div style="font-size:28px;font-weight:900">TEC</div>
<div style="font-size:13px;color:#9ca3af;margin-top:8px">Signing you in…</div></div>
<script>
(function () {
  var redirect = ${esc(JSON.stringify(redirect))};
  var cookies  = ${esc(JSON.stringify(jsCookies))};
  function setDocCookies() {
    for (var i = 0; i < cookies.length; i++) {
      var c = cookies[i];
      document.cookie = c.name + '=' + encodeURIComponent(c.value) +
        '; path=/; max-age=' + c.maxAge + '; secure; samesite=none';
    }
  }
  function sessionVisible(cb) {
    fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' })
      .then(function (r) { cb(r.ok); })
      .catch(function () { cb(false); });
  }
  sessionVisible(function (ok) {
    if (ok) { location.replace(redirect); return; }
    setDocCookies();
    sessionVisible(function (ok2) {
      location.replace(ok2 ? redirect : '/?login=failed');
    });
  });
})();
</script></body></html>`;

  const res = new NextResponse(html, {
    status:  200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });

  res.cookies.set('tec_access_token', accessToken,          cookieOpts);
  res.cookies.set('tec_user',         JSON.stringify(user), cookieOpts);
  res.cookies.set('tec_csrf',         csrf,                 cookieOpts);

  // The refresh token stays httpOnly (server-only) — needed by the BFF's
  // server-side refresh to renew the session every hour.
  const refreshToken = payload.refreshToken as string | undefined;
  if (refreshToken) {
    res.cookies.set('tec_refresh_token', refreshToken, {
      ...cookieOpts,
      httpOnly: true,
      maxAge:   60 * 60 * 24 * 7,
    });
  }

  return res;
}
