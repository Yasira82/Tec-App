import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { isE2eMode } from '@/lib/server/e2e-mode';
import { fetchWithTimeout } from '@/lib/server/fetch-with-timeout';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

const REQUIRED_FIELDS = ['userId', 'amount', 'currency', 'payment_method'] as const;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── requestId — propagate أو أنشئ جديد ──────────────────
  const requestId = req.headers.get('x-request-id') ?? randomUUID();

  try {
    const body = await req.json();

    // Validate required fields — applies in all modes
    const missing = REQUIRED_FIELDS.filter((f) => body[f] == null || body[f] === '');
    if (missing.length > 0) {
      return NextResponse.json(
        { error: 'Missing required fields', missing, requestId },
        { status: 400, headers: { 'X-Request-ID': requestId } },
      );
    }

    if (isE2eMode()) {
      return NextResponse.json(
        {
          success:    true,
          data: {
            payment_id:     randomUUID(),
            status:         'pending',
            amount:         body.amount,
            currency:       body.currency ?? 'PI',
            payment_method: body.payment_method,
          },
          requestId,
        },
        { status: 201, headers: { 'X-Request-ID': requestId } },
      );
    }

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
