import { NextRequest, NextResponse } from 'next/server';
import { isE2eMode } from '@/lib/server/e2e-mode';
import { fetchWithTimeout } from '@/lib/server/fetch-with-timeout';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isE2eMode()) {
    return NextResponse.json(
      { success: true, data: { action: 'no_action_needed', message: 'E2E stub response' } },
      { status: 200 },
    );
  }

  try {
    // ✅ قراءة من URL أو body
    const piFromQuery   = req.nextUrl.searchParams.get('pi_payment_id');
    const body          = await req.json().catch(() => ({})) as Record<string, unknown>;
    const pi_payment_id = (piFromQuery ?? body?.pi_payment_id) as string | undefined;

    if (!pi_payment_id) {
      return NextResponse.json({ error: 'pi_payment_id required' }, { status: 400 });
    }

    // ✅ بنبعت في الـ URL + الـ body للـ Gateway
    const res = await fetchWithTimeout(
      `${GATEWAY}/api/payment/resolve-incomplete?pi_payment_id=${encodeURIComponent(pi_payment_id)}`,
      {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  authHeader,
        },
        body: JSON.stringify({ pi_payment_id }),
      },
    );

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
