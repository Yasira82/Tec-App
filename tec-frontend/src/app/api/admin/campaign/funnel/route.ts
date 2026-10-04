import { NextRequest, NextResponse } from 'next/server';

/**
 * The campaign funnel: viewed → tapped → arrived → qualified → claimed → paid, per
 * app, and why people stopped. ADMIN — decided by identity-service from the token.
 *
 * No `x-internal-key`, for the same reason as the claims route: the service reads it
 * as a ServiceActor and would skip the role check. Only the session goes downstream.
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const res = await fetch(`${GATEWAY}/api/identity/campaign/funnel`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
