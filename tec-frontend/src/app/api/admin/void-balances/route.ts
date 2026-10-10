import { NextRequest, NextResponse } from 'next/server';

/**
 * Reverse TEC balances with no sale behind them — admin (tec-core-backend #402).
 *
 * GET  → the dry run (reads only). POST → the reviewed run: { runId, expectedTotal,
 * confirm }. Only the session token goes downstream — wallet-service decides who is
 * an admin from that token's signed role — and only those three fields are forwarded.
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';
const URL_ = () => `${GATEWAY}/api/wallets/admin/void-unbacked`;

const pass = async (res: Response) =>
  NextResponse.json(await res.json().catch(() => ({})), { status: res.status });

export async function GET(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return pass(await fetch(URL_(), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }));
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { runId, expectedTotal, confirm } = (body ?? {}) as Record<string, unknown>;
  try {
    return pass(await fetch(URL_(), {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ runId, expectedTotal, confirm }),
      cache:   'no-store',
    }));
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
