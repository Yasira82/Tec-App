import { NextRequest, NextResponse } from 'next/server';

/**
 * Merge a Pioneer's duplicate accounts into the oldest — admin (tec-core-backend #403).
 *
 * GET ?username=&service= → the dry run (writes nothing). POST → the merge: { username, confirm }.
 * Only the session token goes downstream — commerce-service decides who is an admin from
 * that token's signed role and asks auth-service which accounts the name has — and only
 * those two fields are forwarded.
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

// Each service that keeps rows under a person's account runs its own merge (it owns
// those rows). `?service=` picks one from this fixed list — never a path from the caller.
const SERVICES: Record<string, string> = {
  commerce: '/api/commerce/admin/account-merge',
  assets:   '/api/assets/admin/account-merge',
  kyc:      '/api/kyc/admin/account-merge',
  notifications: '/api/notification/admin/account-merge',
};
const URL_ = (req: NextRequest) => {
  const service = req.nextUrl.searchParams.get('service') ?? 'commerce';
  return Object.hasOwn(SERVICES, service) ? `${GATEWAY}${SERVICES[service]}` : null;
};
const unknown = () => NextResponse.json({ error: 'Unknown service' }, { status: 400 });

const pass = async (res: Response) =>
  NextResponse.json(await res.json().catch(() => ({})), { status: res.status });

export async function GET(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const username = req.nextUrl.searchParams.get('username') ?? '';
  const url = URL_(req);
  if (!url) return unknown();
  try {
    return pass(await fetch(`${url}?username=${encodeURIComponent(username)}`, {
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
  const url = URL_(req);
  if (!url) return unknown();
  try {
    return pass(await fetch(url, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, confirm }),
      cache:   'no-store',
    }));
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
