import { NextRequest, NextResponse } from 'next/server';

/**
 * Pi usernames that still have more than one account — admin, read-only
 * (tec-core-backend #403). Only the session token goes downstream; auth-service
 * decides who is an admin from that token's signed role.
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const res = await fetch(`${GATEWAY}/api/auth/admin/duplicate-accounts`, {
      headers: { Authorization: `Bearer ${token}` },
      cache:   'no-store',
    });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
