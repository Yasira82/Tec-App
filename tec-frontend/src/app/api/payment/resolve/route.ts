import { NextRequest, NextResponse } from 'next/server';
import { gatewayPost, getAccessToken } from '@/lib/server/payment-gateway';

export async function POST(request: NextRequest) {
  if (!getAccessToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { pi_payment_id } = await request.json().catch(() => ({} as Record<string, unknown>));
  if (!pi_payment_id) {
    return NextResponse.json({ error: 'pi_payment_id required' }, { status: 400 });
  }

  // Singular /api/payment/ path matches gateway routing. gatewayPost refreshes
  // an expired token once so the incomplete payment is always resolved.
  const { status, data } = await gatewayPost(
    request,
    '/api/payment/resolve-incomplete',
    { pi_payment_id },
  );
  return NextResponse.json(data, { status });
}
