import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  try {
    // ← /api/wallets?userId= بدل /api/wallets/balance
    const res = await fetch(
      `${GATEWAY}/api/wallets?userId=${userId}`,
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

    // الـ wallet service بيرجع { success, data: { wallets: [] } }
    // نجيب الـ primary wallet
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
