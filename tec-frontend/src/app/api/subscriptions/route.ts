import { NextRequest, NextResponse } from 'next/server';
import { isE2eMode, e2eStub } from '@/lib/server/e2e-mode';
import { fetchWithTimeout } from '@/lib/server/fetch-with-timeout';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const endpoint   = req.nextUrl.searchParams.get('endpoint') ?? 'status';
  if (isE2eMode()) return e2eStub(503, { route: '/api/subscriptions', method: 'GET' });
  try {
    const res = await fetchWithTimeout(`${GATEWAY}/api/commerce/subscriptions/${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const endpoint   = req.nextUrl.searchParams.get('endpoint') ?? 'subscribe';
  if (isE2eMode()) return e2eStub(503, { route: '/api/subscriptions', method: 'POST' });
  try {
    const body = await req.json();
    const res  = await fetchWithTimeout(`${GATEWAY}/api/commerce/subscriptions/${endpoint}`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (isE2eMode()) return e2eStub(503, { route: '/api/subscriptions', method: 'PATCH' });
  try {
    const body = await req.json();
    const res  = await fetchWithTimeout(`${GATEWAY}/api/commerce/subscriptions/cancel`, {
      method:  'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
