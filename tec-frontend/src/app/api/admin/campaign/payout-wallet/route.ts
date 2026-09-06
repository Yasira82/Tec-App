import { NextRequest, NextResponse } from 'next/server';

/**
 * Is the payout wallet set up, and which wallet is it?
 *
 * No `x-internal-key`, like the claims route beside it: identity-service reads
 * that header as a ServiceActor credential and skips the role check. Only the
 * session token goes downstream and the SERVICE decides — the Hub's own
 * `role === 'admin'` hides a button and grants nothing.
 *
 * What comes back is the wallet's PUBLIC key, never the seed. A seed cannot be
 * read back to check; a public key can be compared against the wallet that was
 * actually funded, and it is public by definition — it is the address people
 * send Pi to.
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const res = await fetch(`${GATEWAY}/api/identity/campaign/payout-wallet`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
