import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function GET(req: NextRequest) {
  const token  = req.cookies.get('tec_access_token')?.value;
  const userId = req.nextUrl.searchParams.get('userId');

  if (!token)  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  try {
    const res  = await fetch(
      `${GATEWAY}/api/notification/unread-count?userId=${encodeURIComponent(userId)}`,
      {
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      },
    );

    if (!res.ok) {
      // ✅ fallback — لو الـ endpoint مش موجود في الـ backend
      return NextResponse.json({ count: 0 }, { status: 200 });
    }

    const data = await res.json();
    return NextResponse.json({ count: data?.count ?? data?.data?.count ?? 0 });
  } catch {
    return NextResponse.json({ count: 0 }, { status: 200 });
  }
}
