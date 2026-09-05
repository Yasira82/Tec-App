import { NextRequest, NextResponse } from 'next/server';

/**
 * Per-app progress toward Pi's `.pi` claim threshold.
 *
 * Pi refuses a domain claim until the connected app has "at least 5 unique
 * KYC'd approved Pioneers engage with it". Twenty-four domains were won at
 * auction and paid for, so this is the list that says which apps are still
 * short — the difference between working the campaign and spraying it.
 *
 * ── The header this route does NOT send ─────────────────────────────────────
 * No `x-internal-key`. identity-service reads that as a ServiceActor credential
 * and skips the role check, so attaching it would hand an app-by-app map of
 * where the platform is thinnest to any signed-in visitor who found the URL.
 *
 * Only the session token goes downstream, and the SERVICE decides. Same
 * argument as `/api/admin/feedback`; same reason it needs pinning rather than
 * trusting, since every other admin-ish route here does attach the key.
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const res = await fetch(`${GATEWAY}/api/identity/pioneer/coverage`, {
      headers: { Authorization: `Bearer ${token}` },
      cache:   'no-store',
    });
    const data = await res.json().catch(() => ({}));
    // Pass the service's status through: a 403 has to REACH the page, or the
    // screen cannot tell "you may not" apart from "nothing to show".
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
