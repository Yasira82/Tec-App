import { NextRequest, NextResponse } from 'next/server';

// Admin-only: reject a user's KYC with a reason. Gateway → tec-kyc-service enforces admin.
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('tec_access_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body   = await req.json().catch(() => ({}));
    const userId = String(body?.userId ?? '');
    const reason = String(body?.reason ?? '').trim();
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
    if (!reason) return NextResponse.json({ error: 'reason required' }, { status: 400 });

    const res  = await fetch(`${GATEWAY}/api/kyc/admin/reject/${encodeURIComponent(userId)}`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ reason }),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
