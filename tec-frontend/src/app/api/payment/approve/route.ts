import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { isE2eMode } from '@/lib/server/e2e-mode';
import { fetchWithTimeout } from '@/lib/server/fetch-with-timeout';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { payment_id, pi_payment_id } = body;

    if (!payment_id) {
      return NextResponse.json({ error: 'Missing payment_id' }, { status: 400 });
    }

    if (isE2eMode()) {
      return NextResponse.json(
        { success: true, data: { payment_id, pi_payment_id, status: 'approved' } },
        { status: 200 },
      );
    }

    const idempotencyKey = randomUUID();

    const res = await fetchWithTimeout(`${GATEWAY}/api/payments/approve`, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        Authorization:     authHeader,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ payment_id, pi_payment_id }),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[Approve Route] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
