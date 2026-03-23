import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;
// = https://api-gateway-production-6a68.up.railway.app

export async function GET(req: NextRequest) {
  // ── Auth check ──────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  // ── Forward to Gateway ──────────────────────────────────
  try {
    const res = await fetch(
      `${GATEWAY}/wallet/balance?userId=${userId}`,
      {
        headers: {
          Authorization:  authHeader,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      },
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Gateway error', status: res.status },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);

  } catch {
    return NextResponse.json(
      { error: 'Service unavailable' },
      { status: 503 },
    );
  }
}
