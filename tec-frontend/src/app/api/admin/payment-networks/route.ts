import { NextRequest, NextResponse } from 'next/server';

/**
 * Which network each payment's π moved on — admin, read-only (tec-core-backend #401).
 *
 * Only the session token goes downstream, never `x-internal-key`: payment-service
 * decides who is an admin from that token's verified role, and adding the key here
 * would not change that, but it would be one more credential in a browser-reachable
 * route for no reason. Only the three parameters the service understands are
 * forwarded — an open query passthrough is how a BFF reaches endpoints it was never
 * meant to expose.
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const src = req.nextUrl.searchParams;
  const qs  = new URLSearchParams();
  for (const key of ['userId', 'offset', 'limit'] as const) {
    const v = src.get(key);
    if (v) qs.set(key, v);
  }

  try {
    const res = await fetch(
      `${GATEWAY}/api/payment/admin/network-report${qs.toString() ? `?${qs}` : ''}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
