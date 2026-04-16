import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function GET(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ count: 0 }, { status: 200 });

  try {
    const res  = await fetch(`${GATEWAY}/api/notification?limit=1`, {
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) return NextResponse.json({ count: 0 }, { status: 200 });

    const data = await res.json();
    const count = data?.data?.unreadCount ?? 0;
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 }, { status: 200 });
  }
}
