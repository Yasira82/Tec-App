import { NextRequest, NextResponse } from 'next/server';

/**
 * The payout queue, and recording a transfer.
 *
 * No `x-internal-key` — identity-service reads that as a ServiceActor
 * credential and skips the role check, and this list contains every claimant's
 * wallet address. Only the session token goes downstream; the SERVICE decides.
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';
const auth = (req: NextRequest) => req.cookies.get('tec_access_token')?.value;

export async function GET(req: NextRequest) {
  const token = auth(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const status = req.nextUrl.searchParams.get('status');
  try {
    const res = await fetch(
      `${GATEWAY}/api/identity/campaign/claims${status ? `?status=${encodeURIComponent(status)}` : ''}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const token = auth(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body   = await req.json().catch(() => ({}));
  const id     = typeof body?.id === 'string' ? body.id : '';
  // A CLOSED set, never the caller's string: an action taken from the body
  // unchecked would let a request reach any path segment under the claim — and
  // one of these now MOVES Pi.
  const action = body?.action === 'reject' ? 'reject'
    : body?.action === 'send' ? 'send'
    : body?.action === 'unpaid' ? 'unpaid'
    : 'paid';
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  try {
    const res = await fetch(`${GATEWAY}/api/identity/campaign/claims/${encodeURIComponent(id)}/${action}`, {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(action === 'paid' ? { tx_id: body?.tx_id ?? '' } : { note: body?.note ?? '' }),
      cache:   'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
