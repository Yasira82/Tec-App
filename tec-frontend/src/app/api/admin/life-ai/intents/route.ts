import { NextRequest, NextResponse } from 'next/server';

/**
 * A2 — the assistant's missing vocabulary (Tec-App #287 · backend Tec-core-backend #389).
 *   objectives — asks per objective, `null` included at zero
 *                (analytics `GET /analytics/admin/ai/intent-objectives?weeks=4`);
 *   unmatched  — the asks that matched no objective, with their excerpt and date
 *                (analytics `GET /analytics/admin/ai/intent-observations?objective=null&weeks=4&limit=100`).
 * Neither carries an identity — the service never selects one.
 *
 * ADMIN — decided by analytics-service from the token's role. No `x-internal-key`:
 * the service reads it as a ServiceActor credential and would skip the role check.
 *
 * The halves fail independently; a failed half is `null` with its status under
 * `unavailable` — never an empty list, which would read as "nothing missing" (E1).
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';
const WEEKS   = 4;

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

  const [objectives, unmatched] = await Promise.all([
    read(`/api/analytics/admin/ai/intent-objectives?weeks=${WEEKS}`, token),
    read(`/api/analytics/admin/ai/intent-observations?objective=null&weeks=${WEEKS}&limit=100`, token),
  ]);

  const refused = (h: Half) => h.status === 401 || h.status === 403;
  if (refused(objectives) && refused(unmatched)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: Math.max(objectives.status, unmatched.status) });
  }

  const unavailable: Record<string, number> = {};
  if (objectives.data === null) unavailable.objectives = objectives.status;
  if (unmatched.data  === null) unavailable.unmatched  = unmatched.status;

  return NextResponse.json({
    success: true,
    data: { weeks: WEEKS, objectives: objectives.data, unmatched: unmatched.data, unavailable },
  });
}
