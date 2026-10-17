import { NextRequest, NextResponse } from 'next/server';

/**
 * Erase an account across services — admin (tec-core-backend #437,
 * KB audits/ACCOUNT_ERASURE_PLAN_2026-10-17.md).
 *
 * GET ?username= → every service's dry run (writes nothing). POST → the erasure:
 * { username, confirm, ref }. Only the session token goes downstream — identity-service decides
 * who is an operator from that token and asks each service for its part — and only those three
 * fields are forwarded.
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';
const BASE = `${GATEWAY}/api/identity/admin/erasure`;

const pass = async (res: Response) =>
  NextResponse.json(await res.json().catch(() => ({})), { status: res.status });

export async function GET(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const username = req.nextUrl.searchParams.get('username') ?? '';
  try {
    return pass(await fetch(`${BASE}/preview?username=${encodeURIComponent(username)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache:   'no-store',
    }));
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { username, confirm, ref } = (body ?? {}) as Record<string, unknown>;
  try {
    return pass(await fetch(BASE, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, confirm, ref }),
      cache:   'no-store',
    }));
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
