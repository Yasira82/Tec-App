import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, amount, currency = 'PI', payment_method = 'pi', metadata } = body;

    if (!userId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, amount' },
        { status: 400 }
      );
    }

    const backendUrl =
      process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
      'https://api-gateway-production-6a68.up.railway.app';

    const idempotencyKey = randomUUID();

    const response = await fetch(`${backendUrl}/api/payments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'Idempotency-Key': idempotencyKey,
        // ✅ x-internal-key (الاسم الصح)
        'x-internal-key': process.env.INTERNAL_SECRET || '',
      },
      body: JSON.stringify({
        userId,
        amount,
        currency,
        payment_method,
        metadata,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('[Payment Create] Backend error:', JSON.stringify(errData));
      return NextResponse.json(
        { error: errData?.message || errData?.error || `Backend error ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: unknown) {
    console.error('[Payment Create Route] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
