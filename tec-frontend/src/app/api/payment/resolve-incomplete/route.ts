import { NextRequest, NextResponse } from 'next/server';
import { isE2eMode } from '@/lib/server/e2e-mode';
import { gatewayPost, getAccessToken } from '@/lib/server/payment-gateway';

export async function POST(req: NextRequest) {
  if (!getAccessToken(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isE2eMode()) {
    return NextResponse.json(
      { success: true, data: { action: 'no_action_needed', message: 'E2E stub response' } },
      { status: 200 },
    );
  }

  const piFromQuery   = req.nextUrl.searchParams.get('pi_payment_id');
  const body          = await req.json().catch(() => ({})) as Record<string, unknown>;
  const pi_payment_id = (piFromQuery ?? body?.pi_payment_id) as string | undefined;

  if (!pi_payment_id) {
    return NextResponse.json({ error: 'pi_payment_id required' }, { status: 400 });
  }

  // Gateway reads pi_payment_id from the query; we also send it in the body.
  // gatewayPost refreshes an expired token once so a stuck incomplete payment
  // is always resolved instead of failing with TOKEN_EXPIRED.
  const { status, data } = await gatewayPost(
    req,
    `/api/payment/resolve-incomplete?pi_payment_id=${encodeURIComponent(pi_payment_id)}`,
    { pi_payment_id },
  );
  return NextResponse.json(data, { status });
}
