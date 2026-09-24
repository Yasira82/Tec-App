import { NextRequest, NextResponse } from 'next/server';
import { randomUUID }                from 'crypto';

const GATEWAY = process.env.API_GATEWAY_URL ?? '';

/**
 * How long this route will wait on the gateway before giving up.
 *
 * An unbounded `fetch` here does not fail — it HANGS, and the whole serverless
 * invocation hangs with it until the platform kills it. A killed function never
 * reaches the catch below, so it cannot log, cannot report, and cannot say what
 * happened: the caller gets the platform's blank "500 Internal Server Error"
 * page with no reason on it. That is the exact failure C-96 exists to forbid,
 * and no amount of error-message work inside the handler can fix it, because
 * the handler is what gets killed.
 *
 * The gateway is already known to stall on an upstream blip (its own logs show
 * `socket hang up` / `ECONNRESET` against services it proxies). A timeout turns
 * "silent 500 with no reason" into "502 that names the cause".
 */
const GATEWAY_TIMEOUT_MS = 8_000;

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get('tec_refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: 'No refresh token found' }, { status: 401 });
    }

    let backendRes: Response;
    try {
      backendRes = await fetch(`${GATEWAY}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${refreshToken}`,
        },
        signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
      });
    } catch (err) {
      // Say which hop died. Reaching here at all is the improvement: without
      // the timeout above, this line is unreachable — the invocation is killed
      // first and nothing is written anywhere.
      const reason = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      console.error('[refresh] gateway unreachable', { reason, timeoutMs: GATEWAY_TIMEOUT_MS });
      return NextResponse.json(
        { error: 'gateway_unreachable', reason: reason.slice(0, 200) },
        { status: 502 },
      );
    }

    const data = await backendRes.json().catch(() => ({}));

    if (!backendRes.ok) {
      return NextResponse.json(data, { status: backendRes.status });
    }

    const newAccessToken  = data.token ?? data.accessToken ?? data.data?.token ?? data.data?.accessToken ?? null;
    const newRefreshToken = data.refreshToken ?? data.data?.refreshToken ?? null;

    if (!newAccessToken) {
      console.error('[refresh] No access token in response:', JSON.stringify(data));
      return NextResponse.json({ error: 'No token in response' }, { status: 502 });
    }

    // ✅ جدد الـ CSRF مع كل refresh
    const newCsrf = randomUUID();

    // sameSite:'none' — keep in sync with pi-login (embedded Pi Browser context
    // rejects 'lax' cookies entirely; July 2026 outage). Never downgrade to 'lax'.
    const cookieOpts = {
      secure:   true,
      sameSite: 'none' as const,
      partitioned: true,
      path:     '/',
    };

    const res = NextResponse.json({ token: newAccessToken });

    res.cookies.set('tec_access_token', newAccessToken, {
      ...cookieOpts,
      httpOnly: false,
      maxAge:   60 * 60 * 24,
    });

    res.cookies.set('tec_csrf', newCsrf, {
      ...cookieOpts,
      httpOnly: false,
      maxAge:   60 * 60 * 24,
    });

    // tec_user was set with the token's 24h life at sign-in, and renewing the
    // token alone left a live token with no user a day later: /api/auth/me →
    // 401 no_user → "Not signed in" while the wallet still worked (C-13 §1).
    // Copied from the request, never invented — no cookie in, no cookie out.
    const user = req.cookies.get('tec_user')?.value;
    if (user) {
      res.cookies.set('tec_user', user, {
        ...cookieOpts,
        httpOnly: false,
        maxAge:   60 * 60 * 24,
      });
    }

    if (newRefreshToken) {
      res.cookies.set('tec_refresh_token', newRefreshToken, {
        ...cookieOpts,
        httpOnly: true,
        maxAge:   60 * 60 * 24 * 7,
      });
    }

    return res;
  } catch (err) {
    console.error('[refresh] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
