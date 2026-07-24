import { NextRequest, NextResponse } from 'next/server';

// Admin-only: list PENDING KYC submissions. The gateway → tec-kyc-service
// enforces role==='admin' (403 otherwise), so this is fail-closed regardless
// of the client.
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('tec_access_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const res  = await fetch(`${GATEWAY}/api/kyc/admin/pending`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
