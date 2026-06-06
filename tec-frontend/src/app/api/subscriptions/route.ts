import { NextRequest, NextResponse } from 'next/server';
import { isE2eMode } from '@/lib/server/e2e-mode';
import { fetchWithTimeout } from '@/lib/server/fetch-with-timeout';

const GATEWAY = process.env.API_GATEWAY_URL ?? '';

// Minimal mock plans payload for E2E mode
const MOCK_PLANS = [
  { id: 'free',       name: 'FREE',       price: 0,    currency: 'PI', features: ['basic'] },
  { id: 'pro',        name: 'PRO',        price: 5,    currency: 'PI', features: ['basic', 'pro'] },
  { id: 'enterprise', name: 'ENTERPRISE', price: 20,   currency: 'PI', features: ['basic', 'pro', 'enterprise'] },
];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const endpoint   = req.nextUrl.searchParams.get('endpoint') ?? 'status';

  // Status endpoint requires authentication
  if (endpoint === 'status') {
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (isE2eMode()) {
      return NextResponse.json(
        { success: true, data: { plan: 'free', status: 'active', renewsAt: null } },
        { status: 200 },
      );
    }
  }

  // Plans endpoint — public, return mock in E2E mode
  if (isE2eMode()) {
    return NextResponse.json({ success: true, data: MOCK_PLANS }, { status: 200 });
  }

  try {
    const res  = await fetchWithTimeout(`${GATEWAY}/api/commerce/subscriptions/${endpoint}`, {
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
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isE2eMode()) {
    return NextResponse.json({ success: true, data: { subscribed: true } }, { status: 200 });
  }

  const endpoint = req.nextUrl.searchParams.get('endpoint') ?? 'subscribe';
  try {
    const body = await req.json();
    const res  = await fetchWithTimeout(`${GATEWAY}/api/commerce/subscriptions/${endpoint}`, {
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

export async function PATCH(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isE2eMode()) {
    return NextResponse.json({ success: true, data: { cancelled: true } }, { status: 200 });
  }

  try {
    const body = await req.json();
    const res  = await fetchWithTimeout(`${GATEWAY}/api/commerce/subscriptions/cancel`, {
      method:  'PATCH',
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
