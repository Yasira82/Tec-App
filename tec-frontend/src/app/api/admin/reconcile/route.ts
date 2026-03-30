import { NextRequest, NextResponse } from 'next/server';

const PAYMENT_SERVICE = 'https://payment-service-production-90e5.up.railway.app';
const INTERNAL_KEY    = process.env.INTERNAL_SECRET ?? 'tec-int-sec-2026-xK9mP3qR';

export async function POST(_req: NextRequest) {
  try {
    const res  = await fetch(`${PAYMENT_SERVICE}/payments/reconcile`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': INTERNAL_KEY,
      },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: 'Reconcile failed', message: String(err) }, { status: 503 });
  }
}

export async function GET(_req: NextRequest) {
  return POST(_req);
}
