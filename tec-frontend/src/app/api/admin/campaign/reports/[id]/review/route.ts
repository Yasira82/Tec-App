import { NextRequest, NextResponse } from 'next/server';

/**
 * Round 3: the owner reviews one report — approve, or ask for a revision with a
 * note the pioneer reads. ADMIN — decided by identity-service from the token,
 * which also writes the audit row.
 *
 * No `x-internal-key`, for the same reason as the claims route: the service reads it
 * as a ServiceActor and would skip the role check. Only the session goes downstream.
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Bad report id' }, { status: 400 });
  const body = await req.json().catch(() => ({})) as { action?: unknown; note?: unknown };
  if (body.action !== 'approve' && body.action !== 'revise') {
    return NextResponse.json({ error: 'action must be approve or revise' }, { status: 400 });
  }
  try {
    const res = await fetch(`${GATEWAY}/api/identity/campaign/reports/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: body.action, ...(typeof body.note === 'string' ? { note: body.note.slice(0, 500) } : {}) }),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
