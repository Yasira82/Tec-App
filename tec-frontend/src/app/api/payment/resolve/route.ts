import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { isE2eMode, e2eStub } from '@/lib/server/e2e-mode';
import { fetchWithTimeout } from '@/lib/server/fetch-with-timeout';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (isE2eMode()) return e2eStub(503, { route: '/api/payment/resolve', method: 'POST' });
  try {
    const { pi_payment_id } = await request.json();
    const res = await fetchWithTimeout(`${GATEWAY}/api/payments/resolve/${pi_payment_id}`, {
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
