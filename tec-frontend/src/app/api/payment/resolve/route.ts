import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { pi_payment_id } = await request.json();
    const res = await fetch(`${GATEWAY}/api/payments/resolve/${pi_payment_id}`, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        Authorization:     authHeader,
        'Idempotency-Key': randomUUID(),
      },
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
