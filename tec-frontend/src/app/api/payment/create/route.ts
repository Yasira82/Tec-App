import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function POST(req: NextRequest) {
  try {
    const { paymentId, txid } = await req.json();
    if (!paymentId || !txid) {
      return NextResponse.json({ error: 'paymentId and txid required' }, { status: 400 });
    }

    const token = req.cookies.get('tec_access_token')?.value;

    const res = await fetch(`${GATEWAY}/api/v1/payment/complete`, {
      method:  'POST',
      headers: {
        'Content-Type':   'application/json',
        'Authorization':  `Bearer ${token ?? ''}`,
        'x-internal-key': process.env.INTERNAL_SECRET ?? '',
      },
      body: JSON.stringify({ paymentId, txid }),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Completion failed' }, { status: 500 });
  }
}
