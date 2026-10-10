import { NextRequest, NextResponse } from 'next/server';

/**
 * Merge a Pioneer's duplicate accounts into the oldest — admin (tec-core-backend #403).
 *
 * GET ?username= → the dry run (writes nothing). POST → the merge: { username, confirm }.
 * Only the session token goes downstream — commerce-service decides who is an admin from
 * that token's signed role and asks auth-service which accounts the name has — and only
 * those two fields are forwarded.
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';
const URL_ = () => `${GATEWAY}/api/commerce/admin/account-merge`;

const pass = async (res: Response) =>
  NextResponse.json(await res.json().catch(() => ({})), { status: res.status });

export async function GET(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const username = req.nextUrl.searchParams.get('username') ?? '';
  try {
    return pass(await fetch(`${URL_()}?username=${encodeURIComponent(username)}`, {
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
  const { username, confirm } = (body ?? {}) as Record<string, unknown>;
  try {
    return pass(await fetch(URL_(), {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, confirm }),
      cache:   'no-store',
    }));
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
