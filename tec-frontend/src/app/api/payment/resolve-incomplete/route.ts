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
      {
        success: true,
        data: { action: 'no_action_needed', message: 'E2E stub response' },
      },
      { status: 200 },
    );
  }

  try {
    const body = await req.json();
    // ✅ singular /api/payment/ — matches Gateway routing
    const res = await fetchWithTimeout(`${GATEWAY}/api/payment/resolve-incomplete`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  authHeader,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
