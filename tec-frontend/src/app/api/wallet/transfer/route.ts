import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.API_GATEWAY_URL ?? process.env.API_GATEWAY_URL!;

export async function POST(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();

    if (!body.fromWalletId || typeof body.fromWalletId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid fromWalletId' }, { status: 400 });
    }
    if (!body.toWalletId || typeof body.toWalletId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid toWalletId' }, { status: 400 });
    }
    if (typeof body.amount !== 'number' || body.amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }

    const res = await fetch(`${GATEWAY}/api/wallets/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
