import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { bffFetch, attemptTokenRefresh, buildExpiredResponse } from '@/lib/bff-fetch';

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

const CreatePaymentSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,8})?$/, 'amount must be a positive decimal string'),
  currency: z.literal('PI'),
  payment_method: z.literal('pi'),
  source: z.string().min(1),
  // Client يبعت idempotency key — أو BFF يولد واحد لو مجاش
  idempotency_key: z.string().uuid().optional(),
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

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('tec_access_token')?.value;
  const csrfCookie = cookieStore.get('tec_csrf')?.value;

  if (!accessToken) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    );
  }

  const csrfHeader = req.headers.get('x-csrf-token');
  if (!csrfHeader || !csrfCookie || !timingSafeStringEqual(csrfHeader, csrfCookie)) {
    return NextResponse.json(
      { success: false, error: { code: 'CSRF_INVALID', message: 'CSRF token mismatch' } },
      { status: 403 },
    );
  }

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

  const { idempotency_key, ...paymentBody }: CreatePaymentBody = parsed.data;

  // ✅ الصح: key جاي من الـ client، أو BFF يولده مرة واحدة هنا
  // ويستخدم نفس الـ key في الـ retry — مش key جديد
  const idempotencyKey = idempotency_key ?? randomUUID();

  const fetchOptions = {
    method: 'POST' as const,
    body: paymentBody as Record<string, unknown>,
    idempotencyKey, // ← نفس الـ key في كل المحاولات
    accessToken,
  };

  const result = await bffFetch<PaymentResponse>('/payments', fetchOptions);

  if (result.tokenExpired) {
    const newToken = await attemptTokenRefresh();
    if (!newToken) return buildExpiredResponse();

    // ✅ نفس idempotencyKey — مش جديد
    const retryResult = await bffFetch<PaymentResponse>('/payments', {
      ...fetchOptions,
      accessToken: newToken,
    });

    if (retryResult.tokenExpired) return buildExpiredResponse();
    if (!retryResult.ok) {
      return NextResponse.json(
        { success: false, error: { code: 'GATEWAY_ERROR', message: retryResult.error } },
        { status: retryResult.status || 502 },
      );
    }

    return NextResponse.json(retryResult.data, { status: 201 });
  }

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: { code: 'GATEWAY_ERROR', message: result.error } },
      { status: result.status || 502 },
    );
  }

  return NextResponse.json(result.data, { status: 201 });
}
