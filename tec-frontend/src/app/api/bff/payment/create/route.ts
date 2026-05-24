import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { bffFetch, attemptTokenRefresh, buildExpiredResponse } from '@/lib/bff-fetch';

// ─── Zod Validation ──────────────────────────────────────────────────────────

const CreatePaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.literal('PI'),
  payment_method: z.literal('pi'),
  source: z.string().min(1),
  metadata: z
    .object({
      app_source: z.string().optional(),
      product_id: z.string().uuid().optional(),
    })
    .optional(),
});

type CreatePaymentBody = z.infer<typeof CreatePaymentSchema>;

interface PaymentResponse {
  success: boolean;
  data: {
    payment: {
      id: string;
      user_id: string;
      amount: string;
      currency: string;
      status: string;
      pi_payment_id: string | null;
      transaction_id: string | null;
      metadata: Record<string, unknown>;
      created_at: string;
    };
  };
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Extract cookies
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('tec_access_token')?.value;
  const csrfCookie = cookieStore.get('tec_csrf')?.value;

  // 2. Auth check
  if (!accessToken) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    );
  }

  // 3. CSRF check (state-mutating POST — required per Kernel Spec)
  const csrfHeader = req.headers.get('x-csrf-token');
  if (!csrfHeader || csrfHeader !== csrfCookie) {
    return NextResponse.json(
      { success: false, error: { code: 'CSRF_INVALID', message: 'CSRF token mismatch' } },
      { status: 403 },
    );
  }

  // 4. Parse & validate body
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

  const body: CreatePaymentBody = parsed.data;

  // 5. Call gateway (with idempotency key — VM-003 fix)
  const result = await bffFetch<PaymentResponse>('/payments', {
    method: 'POST',
    body: body as Record<string, unknown>,
    addIdempotencyKey: true, // ← generates UUID per request
    accessToken,
  });

  // 6. Handle token expiry — attempt silent refresh then retry once
  if (result.tokenExpired) {
    const newToken = await attemptTokenRefresh();
    if (!newToken) return buildExpiredResponse();

    const retryResult = await bffFetch<PaymentResponse>('/payments', {
      method: 'POST',
      body: body as Record<string, unknown>,
      addIdempotencyKey: true, // new key for retry — correct behavior
      accessToken: newToken,
    });

    if (retryResult.tokenExpired || !retryResult.ok) {
      return retryResult.tokenExpired
        ? buildExpiredResponse()
        : NextResponse.json(
            { success: false, error: { code: 'GATEWAY_ERROR', message: retryResult.error } },
            { status: retryResult.status || 502 },
          );
    }

    return NextResponse.json(retryResult.data, { status: 201 });
  }

  // 7. Gateway non-200
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: { code: 'GATEWAY_ERROR', message: result.error } },
      { status: result.status || 502 },
    );
  }

  return NextResponse.json(result.data, { status: 201 });
}
