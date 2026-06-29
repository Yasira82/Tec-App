import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// ⚠️ TEMP diagnostic — why are wallet (access token) AND /api/auth/refresh both
// returning 401? Reports access-token verify + refresh-token presence + the
// backend refresh response. No secret values returned. DELETE after reading.
export async function GET(req: NextRequest) {
  const access  = req.cookies.get('tec_access_token')?.value;
  const refresh = req.cookies.get('tec_refresh_token')?.value;
  const gateway = process.env.API_GATEWAY_URL ?? '';

  const out: Record<string, unknown> = {
    accessPresent:       !!access,
    refreshPresent:      !!refresh,
    jwtSecretConfigured: !!process.env.JWT_SECRET,
    gatewayConfigured:   !!gateway,
  };

  // 1) Access token: decode claims + verify
  if (access) {
    const parts = access.split('.');
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        const now     = Math.floor(Date.now() / 1000);
        out.access = {
          hasSub:             !!payload.sub,
          exp:                payload.exp ?? null,
          expired:            payload.exp ? payload.exp < now : null,
          secondsSinceExpiry: payload.exp ? now - payload.exp : null,
        };
      } catch (e) { out.accessDecodeError = String(e); }
    }
    if (process.env.JWT_SECRET) {
      try {
        await jwtVerify(access, new TextEncoder().encode(process.env.JWT_SECRET), { algorithms: ['HS256'] });
        out.accessVerify = 'OK';
      } catch (e) {
        out.accessVerify      = 'FAIL';
        out.accessVerifyError = (e as { code?: string; name?: string })?.code ?? (e as { name?: string })?.name ?? String(e);
      }
    }
  }

  // 2) Refresh token: ask the backend exactly what the Hub's /api/auth/refresh asks
  if (refresh && gateway) {
    try {
      const r = await fetch(`${gateway}/api/v1/auth/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${refresh}` },
      });
      const text = await r.text().catch(() => '');
      out.backendRefresh = { status: r.status, body: text.slice(0, 300) };
    } catch (e) {
      out.backendRefresh = { error: String(e) };
    }
  }

  return NextResponse.json(out);
}
