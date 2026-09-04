import { NextRequest, NextResponse } from 'next/server';

/**
 * The feedback inbox — admin read + triage.
 *
 * ── The header this route deliberately does NOT send ────────────────────────
 * Every other admin-ish route in this app attaches `x-internal-key` alongside
 * the user's token. Doing that HERE would defeat the point: the identity
 * service treats that key as a ServiceActor credential and skips the role
 * check entirely, so any signed-in visitor who found this URL would read
 * everyone's messages (Forbidden Behavior #7).
 *
 * Only the session token goes downstream. `tec-identity-service` verifies it
 * and requires `role === 'admin'` — the decision belongs to the layer that can
 * actually check it, not to this one (Policy Precedence: an upper layer must
 * never weaken a lower one). A non-admin gets a 403 from the service, and this
 * route passes it through unchanged.
 *
 * The page in front of this hides itself from non-admins, but that is a
 * courtesy. THIS is not the enforcement point either — the service is.
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

const auth = (req: NextRequest) => req.cookies.get('tec_access_token')?.value;

export async function GET(req: NextRequest) {
  const token = auth(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Forward only the filters the service understands. Anything else is
  // dropped rather than proxied — an open query passthrough is how a BFF
  // becomes a way to reach endpoints it was never meant to expose.
  const src = req.nextUrl.searchParams;
  const qs  = new URLSearchParams();
  for (const key of ['status', 'app', 'limit'] as const) {
    const v = src.get(key);
    if (v) qs.set(key, v);
  }

  try {
    const res = await fetch(
      `${GATEWAY}/api/identity/feedback${qs.toString() ? `?${qs}` : ''}`,
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

  const body = await req.json().catch(() => ({}));
  const id     = typeof body?.id === 'string' ? body.id : '';
  const status = typeof body?.status === 'string' ? body.status : '';
  if (!id || !status) {
    return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
  }

  try {
    const res = await fetch(`${GATEWAY}/api/identity/feedback/${encodeURIComponent(id)}/status`, {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status }),
      cache:   'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
