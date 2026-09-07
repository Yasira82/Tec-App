import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { networkMetadata } from '@/lib/pi-network';

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

  // The Hub is the Mode-1 payment path for ALL 24 apps, and its metadata
  // schema is `.passthrough()` — so this is the one route where a browser
  // could name the network its own payment settles on.
  //
  // `metadata.testnet` is not decoration. payment-service's getPiApiKey
  // selects PI_API_KEY_<SLUG>_TESTNET from it, and commerce refuses to grant
  // PRO for it. Whoever sets it decides whether a payment is free.
  //
  // REMOVED, not overwritten. On a Mainnet host networkMetadata() returns an
  // empty object, so spreading it over the caller's bag overwrites NOTHING and
  // the claim survives intact. Stripped here, before the spread, so a later
  // edit that reorders the object cannot hand the network back.
  const { amount, currency, payment_method, metadata: clientMetadata, idempotency_key } = parsed.data;
  const { testnet: _clientTestnet, ...metadata } = clientMetadata ?? {};
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
      // Derived from this route's OWN Host header, and present only when true —
      // a Mainnet payment carries no such key, so its payload is byte-identical
      // to what it has always been.
      body: JSON.stringify({
        amount: Number(amount), currency, payment_method,
        metadata: { ...metadata, ...networkMetadata(req.headers.get('host')) },
      }),
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
