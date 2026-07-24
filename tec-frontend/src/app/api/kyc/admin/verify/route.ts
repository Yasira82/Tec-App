import { NextRequest, NextResponse } from 'next/server';

// Admin-only: verify a user's KYC. Gateway → tec-kyc-service enforces admin.
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('tec_access_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body   = await req.json().catch(() => ({}));
    const userId = String(body?.userId ?? '');
    const level  = body?.level === 'L2' ? 'L2' : 'L1';
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const res  = await fetch(`${GATEWAY}/api/kyc/admin/verify/${encodeURIComponent(userId)}`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ level }),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
