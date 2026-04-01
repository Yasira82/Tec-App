import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── requestId — propagate أو أنشئ جديد ──────────────────
  const requestId = req.headers.get('x-request-id') ?? randomUUID();

  try {
    const body           = await req.json();
    const idempotencyKey = randomUUID();

    const res = await fetch(`${GATEWAY}/api/payments/create`, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        Authorization:     authHeader,
        'Idempotency-Key': idempotencyKey,
        'X-Request-ID':    requestId,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    // ── Echo requestId في الـ response ──────────────────────
    return NextResponse.json(data, {
      status:  res.status,
      headers: { 'X-Request-ID': requestId },
    });
  } catch {
    return NextResponse.json(
      { error: 'Service unavailable', requestId },
      {
        status:  503,
        headers: { 'X-Request-ID': requestId },
      }
    );
  }
}
