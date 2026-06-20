import { NextRequest, NextResponse } from 'next/server';
import { isE2eMode } from '@/lib/server/e2e-mode';
import { gatewayPost, getAccessToken } from '@/lib/server/payment-gateway';

export async function POST(req: NextRequest) {
  if (!getAccessToken(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isE2eMode()) {
    return NextResponse.json({ success: true, data: { status: 'cancelled' } }, { status: 200 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const pi_payment_id = body?.pi_payment_id;
  if (!pi_payment_id || typeof pi_payment_id !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid pi_payment_id' }, { status: 400 });
  }

  // gatewayPost refreshes an expired token once so cancel never fails with
  // TOKEN_EXPIRED and leave the payment stuck.
  const { status, data } = await gatewayPost(req, '/api/payment/cancel', { pi_payment_id });
  return NextResponse.json(data, { status });
}
