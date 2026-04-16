import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function GET(req: NextRequest) {
  const token  = req.cookies.get('tec_access_token')?.value;
  const userId = req.nextUrl.searchParams.get('userId');

  if (!token)  return NextResponse.json({ error: 'Unauthorized' },     { status: 401 });
  if (!userId) return NextResponse.json({ error: 'userId required' },  { status: 400 });

  try {
    const res  = await fetch(
      `${GATEWAY}/api/wallets?userId=${encodeURIComponent(userId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data    = await res.json().catch(() => ({}));
    const wallets = data?.data?.wallets ?? [];
    const primary = wallets.find((w: { is_primary?: boolean }) => w.is_primary) ?? wallets[0];

    if (!primary) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });

    return NextResponse.json({ walletId: primary.id });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
