import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const endpoint   = req.nextUrl.searchParams.get('endpoint') ?? 'status';
  try {
    const res = await fetch(`${GATEWAY}/api/commerce/subscriptions/${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const endpoint   = req.nextUrl.searchParams.get('endpoint') ?? 'subscribe';
  try {
    const body = await req.json();
    const res  = await fetch(`${GATEWAY}/api/commerce/subscriptions/${endpoint}`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  try {
    const body = await req.json();
    const res  = await fetch(`${GATEWAY}/api/commerce/subscriptions/cancel`, {
      method:  'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
