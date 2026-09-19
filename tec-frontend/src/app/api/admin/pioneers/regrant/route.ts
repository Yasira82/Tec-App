import { NextRequest, NextResponse } from 'next/server';

/**
 * Re-ask commerce for Founding gifts that never arrived.
 *
 * `giftFoundingPro` runs exactly once per pioneer — at the moment the Founding
 * number is written — and is fail-safe by design, so a commerce outage lasting
 * the one second somebody completed in cost them six months of PRO permanently,
 * with a log line as the only trace.
 *
 * The recovery existed in `tec-identity-service` and had no caller. This repo
 * is where the campaign is actually worked from, on a phone, so an endpoint
 * reachable only by hand-crafting a POST with an admin JWT was work that did
 * nothing.
 *
 * ── Safe to run, and safe to run twice ──────────────────────────────────────
 * Commerce dedupes by the note (`Founding Pioneer #N`, unique per pioneer), so
 * a gift that already landed comes back ALREADY_GRANTED and nothing changes.
 * The `granted` count in the response is therefore *the number of gifts that
 * had been lost* — which is why the service asks commerce rather than trusting
 * a flag of its own, and why this route must pass that shape through untouched.
 *
 * ── The header this route does NOT send ─────────────────────────────────────
 * No `x-internal-key`. identity-service reads it as a ServiceActor credential
 * and skips the role check — which on a route that WRITES subscriptions would
 * let any signed-in visitor who found the URL trigger a fleet-wide grant pass.
 * Only the session token goes downstream, and the SERVICE decides.
 *
 * Same argument as `/api/admin/pioneers/coverage`; it matters more here,
 * because that one only reads.
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const res = await fetch(`${GATEWAY}/api/identity/pioneer/regrant`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
      cache:   'no-store',
    });
    const data = await res.json().catch(() => ({}));
    // Pass the service's status through: a 403 has to REACH the page, or the
    // screen cannot tell "you may not" apart from "nothing to repair".
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
