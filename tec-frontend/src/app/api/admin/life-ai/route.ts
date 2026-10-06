import { NextRequest, NextResponse } from 'next/server';

/**
 * M1 — the two numbers before any Life/AI expansion (Tec-App #285 · backend #387):
 *   consent — how many people granted TEC AI at least one Life category, per category
 *             (identity-service `GET /identity/life/admin/consent-coverage`);
 *   usage   — the assistant's messages and people per ISO week
 *             (analytics-service `GET /analytics/admin/ai/usage?weeks=8`).
 *
 * ADMIN — decided by each service from the token's role. No `x-internal-key`, for the
 * same reason as the funnel and coverage routes: a service reads that header as a
 * ServiceActor credential and would skip the role check. Only the session goes down.
 *
 * The two sources are independent and each can fail on its own (one service
 * redeploying, one not yet live). A failed half is reported as `null` with its
 * status under `unavailable` — NEVER as zeros (C-47 §10 E1): "0 people granted
 * consent" and "could not read" are different facts, and the card must show which.
 * Only an auth refusal on BOTH sides becomes the response status, so the page can
 * tell "you may not" apart from "nothing to show".
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';
const WEEKS   = 8;

interface Half { data: unknown | null; status: number }

async function read(path: string, token: string): Promise<Half> {
  try {
    const res  = await fetch(`${GATEWAY}${path}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    const body = await res.json().catch(() => ({}));
    return { data: res.ok ? (body?.data ?? null) : null, status: res.status };
  } catch {
    return { data: null, status: 502 };
  }
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [consent, usage] = await Promise.all([
    read('/api/identity/life/admin/consent-coverage', token),
    read(`/api/analytics/admin/ai/usage?weeks=${WEEKS}`, token),
  ]);

  const refused = (h: Half) => h.status === 401 || h.status === 403;
  if (refused(consent) && refused(usage)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: Math.max(consent.status, usage.status) });
  }

  const unavailable: Record<string, number> = {};
  if (consent.data === null) unavailable.consent = consent.status;
  if (usage.data   === null) unavailable.usage   = usage.status;

  return NextResponse.json({
    success: true,
    data: { consent: consent.data, usage: usage.data, unavailable },
  });
}
