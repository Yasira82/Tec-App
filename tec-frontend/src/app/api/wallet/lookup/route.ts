import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.API_GATEWAY_URL!;

export async function GET(req: NextRequest) {
  const token      = req.cookies.get('tec_access_token')?.value;
  const userId     = req.nextUrl.searchParams.get('userId');
  const piUsername = req.nextUrl.searchParams.get('piUsername');

  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!userId && !piUsername) return NextResponse.json({ error: 'userId or piUsername required' }, { status: 400 });

  try {
    let resolvedUserId = userId;

    // ✅ لو بعتنا piUsername — نحوله لـ userId أول
    if (piUsername && !userId) {
      const userRes  = await fetch(
        `${GATEWAY}/api/v1/auth/user-by-username?piUsername=${encodeURIComponent(piUsername)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const userData = await userRes.json().catch(() => ({}));
      resolvedUserId = userData?.data?.id ?? userData?.id ?? null;
      if (!resolvedUserId) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
    }

    const res     = await fetch(
      `${GATEWAY}/api/wallets?userId=${encodeURIComponent(resolvedUserId!)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data    = await res.json().catch(() => ({}));
    const wallets = data?.data?.wallets ?? [];
    const primary = wallets.find((w: { is_primary?: boolean }) => w.is_primary) ?? wallets[0];

    if (!primary) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });

    return NextResponse.json({ walletId: primary.id, userId: resolvedUserId });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
