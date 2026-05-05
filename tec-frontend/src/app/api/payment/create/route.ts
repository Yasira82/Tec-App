src/app/api/payment/complete/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { isE2eMode } from '@/lib/server/e2e-mode';
import { fetchWithTimeout } from '@/lib/server/fetch-with-timeout';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

const REQUIRED_FIELDS = ['amount', 'currency', 'payment_method'] as const;

function getUserIdFromToken(authHeader: string): string | null {
  try {
    const token   = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload?.sub ?? payload?.id ?? null;
  } catch { return null; }
}

function getUserIdFromCookie(req: NextRequest): string | null {
  try {
    const raw = req.cookies.get('tec_user')?.value;
    if (!raw) return null;
    const user = JSON.parse(decodeURIComponent(raw));
    return user?.id ?? user?.uid ?? null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const authHeader =
    req.headers.get('authorization') ??
    req.headers.get('Authorization') ??
    (() => {
      const raw = req.cookies.get('tec_access_token')?.value;
      return raw ? `Bearer ${raw}` : null;
    })();

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requestId = req.headers.get('x-request-id') ?? randomUUID();

  try {
    const body = await req.json();

    // ✅ VM-NEW-003: userId من cookie أو JWT فقط — مش من body
    const userId =
      getUserIdFromCookie(req) ??
      getUserIdFromToken(authHeader);

    if (!userId) {
      return NextResponse.json(
        { error: 'Cannot resolve userId from session', requestId },
        { status: 401, headers: { 'X-Request-ID': requestId } },
      );
    }

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
          success: true,
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
      body: JSON.stringify({
        ...body,
        userId, // ✅ دايماً من cookie/JWT
      }),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, {
      status:  res.status,
      headers: { 'X-Request-ID': requestId },
    });
  } catch {
    return NextResponse.json(
      { error: 'Service unavailable', requestId },
      { status: 503, headers: { 'X-Request-ID': requestId } },
    );
  }
}
