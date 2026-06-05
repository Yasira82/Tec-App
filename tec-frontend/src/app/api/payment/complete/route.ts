import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { isE2eMode } from '@/lib/server/e2e-mode';
import { fetchWithTimeout } from '@/lib/server/fetch-with-timeout';

const GATEWAY = process.env.API_GATEWAY_URL ?? process.env.API_GATEWAY_URL!;

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

  if (isE2eMode()) {
    return NextResponse.json(
      { success: true, data: { status: 'completed' } },
      { status: 200 },
    );
  }

  try {
    const body           = await req.json();
    const idempotencyKey = randomUUID();

    const res = await fetchWithTimeout(`${GATEWAY}/api/v1/payments/complete`, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        Authorization:     authHeader,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
