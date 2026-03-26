import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto'; // 1. أضف هذا الاستيراد

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { payment_id, pi_payment_id } = body;

    if (!payment_id) {
      return NextResponse.json({ error: 'Missing required field: payment_id' }, { status: 400 });
    }

    const backendUrl =
      process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
      'https://api-gateway-production-6a68.up.railway.app';

    // 2. قم بتوليد مفتاح الـ Idempotency
    const idempotencyKey = randomUUID();

    const response = await fetch(`${backendUrl}/api/payments/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        'Idempotency-Key': idempotencyKey, // 3. أضف هذا الهيدر هنا
      },
      body: JSON.stringify({ payment_id, pi_payment_id }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errData?.error?.message || `Backend error ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('[Payment Approve Route] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
