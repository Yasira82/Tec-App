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
  //
  // The set was right; the FALLBACK was not. Anything unrecognised used to land
  // on `paid` — the action that records a payment. Not exploitable, because
  // `markPaid` still demands a 64-hex hash the chain confirms and no other seat
  // holds, so the defence downstream held. The defect was the default: P6 says
  // doubt DENIES, and here doubt chose the most consequential verb in the set.
  // A typo, a malformed body, or a future caller sending `Paid` is now refused
  // instead of being interpreted generously.
  const ACTIONS = ['paid', 'reject', 'send', 'unpaid'] as const;
  const action  = ACTIONS.find((a) => a === body?.action);
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  if (!action) {
    return NextResponse.json(
      { error: `action must be one of: ${ACTIONS.join(', ')}` },
      { status: 400 },
    );
  }

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
