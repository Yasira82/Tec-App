import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { isE2eMode, e2eStub } from '@/lib/server/e2e-mode';
import { fetchWithTimeout } from '@/lib/server/fetch-with-timeout';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (isE2eMode()) return e2eStub(503, { route: '/api/payment/create', method: 'POST' });

  // ── requestId — propagate أو أنشئ جديد ──────────────────
  const requestId = req.headers.get('x-request-id') ?? randomUUID();

  try {
    const body           = await req.json();
    const idempotencyKey = randomUUID();

    const res = await fetchWithTimeout(`${GATEWAY}/api/payments/create`, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        Authorization:     authHeader,
        'Idempotency-Key': idempotencyKey,
        'X-Request-ID':    requestId,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

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
