import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

// دالة مساعدة لاستخراج الـ userId من الكوكي
function getUserIdFromCookie(req: NextRequest): string | null {
  try {
    const raw = req.cookies.get('tec_user')?.value;
    if (!raw) return null;
    const decoded = decodeURIComponent(raw);
    const user = JSON.parse(decoded);
    return user?.id ?? user?.uid ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ✅ الأولوية للكوكي، ثم الـ searchParams كاحتياطي
  const userId = getUserIdFromCookie(req) || req.nextUrl.searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId required (missing tec_user cookie)' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${GATEWAY}/api/wallets?userId=${encodeURIComponent(userId)}`,
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
        { error: `Balance error: ${res.status}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    const wallets = data?.data?.wallets ?? [];
    const primary = wallets.find((w: any) => w.is_primary) ?? wallets[0];

    return NextResponse.json({
      balance:  primary ? Number(primary.balance) : 0,
      currency: primary?.currency ?? 'PI',
      address:  primary?.wallet_address ?? null,
    });

  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
