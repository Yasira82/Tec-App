import { NextRequest, NextResponse } from 'next/server';
import { checkAssetQuota }           from '@/lib/subscription/plan.server';

const GATEWAY = process.env.API_GATEWAY_URL ?? '';

// Best-effort userId from a Bearer JWT (unverified — the gateway is the real
// authority; this is only to count the caller's assets for the quota gate).
const userIdFromBearer = (authHeader: string): string | null => {
  try {
    const token   = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return (payload.sub ?? payload.id ?? payload.userId) ?? null;
  } catch { return null; }
};

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    // ✅ الـ route الجديد بعد fix الـ global prefix
    const url = userId ? `${GATEWAY}/api/assets/user/${userId}` : `${GATEWAY}/api/assets`;

    const res = await fetch(url, {
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // Same FREE asset cap as /api/assets/provision — enforce here too so the
    // limit can't be bypassed via this entry point.
    const token  = req.cookies.get('tec_access_token')?.value ?? authHeader.replace('Bearer ', '');
    const userId = userIdFromBearer(authHeader);
    if (userId) {
      const quota = await checkAssetQuota(token, userId);
      if (!quota.allowed) {
        return NextResponse.json(
          {
            error:        `Your ${quota.plan} plan allows up to ${quota.limit} assets. Upgrade to Pro for unlimited assets.`,
            code:         'UPGRADE_REQUIRED',
            requiredPlan: 'PRO',
            limit:        quota.limit,
            owned:        quota.owned,
          },
          { status: 402 },
        );
      }
    }

    const body = await req.json();
    // ✅ الـ route الجديد
    const res = await fetch(`${GATEWAY}/api/assets/provision`, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
