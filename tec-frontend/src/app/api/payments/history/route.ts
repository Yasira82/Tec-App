import { NextRequest, NextResponse } from 'next/server';
import { isE2eMode, e2eStub } from '@/lib/server/e2e-mode';
import { fetchWithTimeout } from '@/lib/server/fetch-with-timeout';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (isE2eMode()) return e2eStub(503, { route: '/api/payments/history', method: 'GET' });
  try {
    const search = req.nextUrl.search;
    const res = await fetchWithTimeout(`${GATEWAY}/api/payments/history${search}`, {
      headers: {
        Authorization:  authHeader,
        'Content-Type': 'application/json',
      },
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
