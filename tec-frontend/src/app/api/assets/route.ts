import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    // ✅ الـ route الجديد بعد fix الـ global prefix
    const url = userId
      ? `${GATEWAY}/api/assets/user/${userId}`
      : `${GATEWAY}/api/assets`;

    const res = await fetch(url, {
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    });
    const data = await res.json();
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
  try {
    const body = await req.json();
    // ✅ الـ route الجديد
    const res = await fetch(`${GATEWAY}/api/assets/provision`, {
      method:  'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
