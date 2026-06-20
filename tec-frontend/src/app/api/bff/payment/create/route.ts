import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { z } from 'zod';

// ✅ Canonical payment-create contract (ADR-009) — IDENTICAL across all 4 apps.
//    - Gateway path: ${GW}/api/payment/create  (gateway rewrites ^/api/payment → /payments)
//    - Internal header: x-internal-key + INTERNAL_SECRET  (the ONLY header the gateway validates)
//    - amount: number  (tec-payment-service stores DECIMAL; Zod coerces, we forward Number)
//    Replaces an earlier divergent bffFetch stack (wrong internal-auth header + a bare
//    "/payments" path) that 404'd against a host-root gateway. Single source of truth.
const GW = process.env.API_GATEWAY_URL ?? '';

const CreatePaymentSchema = z.object({
  amount:          z.coerce.number().positive('amount must be a positive number'),
  currency:        z.literal('PI').default('PI'),
  payment_method:  z.literal('pi').default('pi'),
  source:          z.string().min(1).optional(),
  idempotency_key: z.string().uuid().optional(),
  metadata: z
    .object({
      app_source: z.string().optional(),
      product_id: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('tec_access_token')?.value;

  if (!accessToken) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    );
  }

  // CSRF enforced once in middleware (double-submit OR first-party Origin) —
  // single source of truth (P2). A duplicate strict double-submit check here
  // risked 403'ing legit payments in Pi Browser (sameSite=None cookie dropped).

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } },
      { status: 400 },
    );
  }

  const parsed = CreatePaymentSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  const { amount, currency, payment_method, metadata, idempotency_key } = parsed.data;
  const idempotencyKey = idempotency_key ?? randomUUID();

  try {
    const res = await fetch(`${GW}/api/payment/create`, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        Authorization:     `Bearer ${accessToken}`,
        ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
        'Idempotency-Key': idempotencyKey,
      },
      // amount forwarded as a number — matches tec-payment-service contract.
      body: JSON.stringify({ amount: Number(amount), currency, payment_method, metadata }),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'GATEWAY_ERROR', message: 'Payment service unavailable' } },
      { status: 502 },
    );
  }
}
