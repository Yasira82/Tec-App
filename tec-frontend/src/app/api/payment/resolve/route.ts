import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { fetchWithTimeout } from '@/lib/server/fetch-with-timeout';

const GATEWAY = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function POST(request: NextRequest) {
  const authHeader =
    request.cookies.get('tec_access_token')?.value
      ? `Bearer ${request.cookies.get('tec_access_token')!.value}`
      : request.headers.get('Authorization') ??
        request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { pi_payment_id } = await request.json();

    if (!pi_payment_id) {
      return NextResponse.json({ error: 'pi_payment_id required' }, { status: 400 });
    }

    const res = await fetchWithTimeout(
      // ✅ singular /api/payment/ — matches Gateway routing
      `${GATEWAY}/api/payment/resolve-incomplete`,
      {
        method:  'POST',
        headers: {
          'Content-Type':    'application/json',
          Authorization:     authHeader,
          'Idempotency-Key': randomUUID(),
        },
        body: JSON.stringify({ pi_payment_id }),
      },
    );

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
