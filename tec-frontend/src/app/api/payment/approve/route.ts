import { NextRequest, NextResponse } from 'next/server';
import { randomUUID }                from 'crypto';
import { isE2eMode }                 from '@/lib/server/e2e-mode';
import { fetchWithTimeout }          from '@/lib/server/fetch-with-timeout';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function POST(req: NextRequest) {
  try {
    // ✅ NextRequest بيقدر يقرأ cookies صح
    const authHeader =
      req.headers.get('Authorization') ??
      req.headers.get('authorization') ??
      (() => {
        const raw = req.cookies.get('tec_access_token')?.value;
        return raw ? `Bearer ${raw}` : null;
      })();

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { payment_id, pi_payment_id } = body;

    if (!payment_id) {
      return NextResponse.json({ error: 'Missing payment_id' }, { status: 400 });
    }

    if (isE2eMode()) {
      return NextResponse.json(
        { success: true, data: { payment_id, pi_payment_id, status: 'approved' } },
        { status: 200 },
      );
    }

    const idempotencyKey = randomUUID();

    const res = await fetchWithTimeout(`${GATEWAY}/api/v1/payments/approve`, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        Authorization:     authHeader,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ payment_id, pi_payment_id }),
    });

    const data = await res.json().catch(() => ({}));
    console.log('[approve] gateway response:', res.status, JSON.stringify(data));

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[approve] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
