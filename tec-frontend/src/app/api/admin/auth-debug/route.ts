import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// ⚠️ TEMP diagnostic — pinpoints why the BFF returns UNAUTHORIZED for the
// logged-in session (expired token vs JWT_SECRET mismatch vs missing claim).
// No secret values are returned. DELETE this route after we read the answer.
export async function GET(req: NextRequest) {
  const token     = req.cookies.get('tec_access_token')?.value;
  const secretSet = !!process.env.JWT_SECRET;

  const out: Record<string, unknown> = {
    tokenPresent:        !!token,
    tokenLength:         token?.length ?? 0,
    jwtSecretConfigured: secretSet,
  };

  // 1) Read the claims WITHOUT verifying (manual base64url decode — not jwt.decode)
  if (token) {
    const parts = token.split('.');
    out.segments = parts.length;
    if (parts.length === 3) {
      try {
        const header  = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        const now     = Math.floor(Date.now() / 1000);
        out.alg = header.alg;
        out.claims = {
          hasSub:             !!payload.sub,
          sub:                payload.sub ? `${String(payload.sub).slice(0, 8)}…` : null,
          pi_username:        payload.pi_username ?? null,
          iat:                payload.iat ?? null,
          exp:                payload.exp ?? null,
          expired:            payload.exp ? payload.exp < now : null,
          secondsSinceExpiry: payload.exp ? now - payload.exp : null,
        };
      } catch (e) {
        out.decodeError = String(e);
      }
    }
  }

  // 2) Actually verify with the Hub's JWT_SECRET → the specific failure reason
  if (token && secretSet) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET as string), {
        algorithms: ['HS256'],
      });
      out.verify = 'OK';
    } catch (e) {
      out.verify      = 'FAIL';
      // 'ERR_JWT_EXPIRED' = token expired (NOT a secret problem)
      // 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' = JWT_SECRET mismatch
      out.verifyError = (e as { code?: string; name?: string })?.code
                     ?? (e as { name?: string })?.name
                     ?? String(e);
    }
  }

  return NextResponse.json(out);
}
