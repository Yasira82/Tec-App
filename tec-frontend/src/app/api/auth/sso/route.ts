import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify }        from 'jose';
import { isAllowedAppUrl } from '@/domains/allowed-origins';

/**
 * How long the handoff waits on its own refresh hop.
 *
 * Deliberately below the refresh route's gateway budget: whoever gives up
 * first decides what the user sees, and this route is the one that can still
 * complete the handoff without a refresh. A stale token produces a login
 * screen; a hung handoff produces a blank 500 nobody can read.
 */
const REFRESH_TIMEOUT_MS = 6_000;


export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get('tec_access_token')?.value;
  const userCookie  = req.cookies.get('tec_user')?.value;

  if (!accessToken || !userCookie) {
    // No Hub session in THIS context — sign in first, then continue to the app.
    //
    // This used to send the visitor to `/` bare. The sign-in button already
    // knows how to finish a trip (`returnTo` → back through this route), but
    // it was never told where the trip was going: a pioneer tapped an app,
    // signed in again, and landed on the Hub instead of the app. Seen in the
    // Vercel log on 2026-09-24 — sso 307 → me 401 → pi-login → /hub.
    //
    // Why the session can be missing 40 seconds after a sign-in: Pi Browser
    // opens apps in different contexts, each with its own cookie jar
    // (C-123 §7). The app's context has never seen the Hub's cookies.
    //
    // Carried only when it is an allowed app ORIGIN — matched on the origin,
    // never a prefix — and re-validated when the button sends it back here,
    // so this can never become a redirect to anywhere.
    const home   = new URL('/', req.url);
    const target = req.nextUrl.searchParams.get('target');
    if (target && isAllowedAppUrl(target)) home.searchParams.set('returnTo', target);
    return NextResponse.redirect(home);
  }

  const target = req.nextUrl.searchParams.get('target');

  // Matched on the ORIGIN, exactly — the same test the no-session branch above
  // and /api/auth/sso-links use. A prefix test (`target.startsWith(t)`) accepted
  // `https://hub.tecosystem.app.evil.com/…`: harmless only because the callback
  // is built from the matched entry, not the target — an allowlist should not
  // depend on that to hold.
  const targetBase = target && isAllowedAppUrl(target) ? new URL(target).origin : undefined;
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
      const csrfToken = req.cookies.get('tec_csrf')?.value ?? '';
      // BOUNDED. This is a chain — sso → refresh → gateway → auth-service —
      // and until now not one hop in it had a timeout. A stall anywhere down
      // that chain did not surface as an error: it held THIS invocation open
      // until the platform killed it, and a killed function never reaches the
      // catch below. That is what a blank "500 Internal Server Error" with no
      // body is, on the one route every app in the fleet enters through.
      //
      // Shorter than the refresh route's own budget so this hop gives up
      // first and we control what the user sees, rather than the platform.
      try {
        const refreshRes = await fetch(`${req.nextUrl.origin}/api/auth/refresh`, {
          method:  'POST',
          headers: {
            Cookie:         req.headers.get('cookie') ?? '',
            'x-csrf-token': csrfToken,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
        });
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          validToken     = refreshData.token ?? accessToken;
          rotatedCookies = refreshRes.headers?.getSetCookie?.() ?? [];
        }
      } catch (err) {
        // Carry on with the un-refreshed token — exactly what the old code did
        // when the refresh returned !ok. The app it lands on re-checks the
        // session and bounces to login if it is stale, which is a screen the
        // user can act on. A hung handoff is not.
        console.warn('[sso] refresh failed — continuing with the existing token', {
          reason: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
        });
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
  } catch (err) {
    // SAY WHY. This handoff is the only way into every app in the fleet, and
    // this catch used to swallow the reason entirely: a tile that "does
    // nothing" and a bare `sso_failed`, with the same response for a malformed
    // user cookie, an unsignable token and a bad target URL.
    //
    // Commerce showed exactly that — 500 from the Hub, while the very same app
    // opened fine when typed directly — and there was nothing to read from a
    // phone. A failure in a path with no alternative must name itself.
    //
    // `reason` is safe to return: it never contains the token (jose errors do
    // not echo it) and the only user data it can carry is a fragment of the
    // caller's OWN cookie, shown back to the caller. The server log carries the
    // full error for anyone who can read it.
    const reason = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error('[sso] handoff failed', { target, reason });
    return NextResponse.json(
      { error: 'sso_failed', target, reason: reason.slice(0, 200) },
      { status: 500 },
    );
  }
}
