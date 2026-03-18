import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // ✅ خد الـ Authorization من الـ request
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const backendUrl =
      process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
      'https://api-gateway-production-6a68.up.railway.app';

    const response = await fetch(
      `${backendUrl}/api/wallets?userId=${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,           // ✅ ضيف الـ token
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('[Wallet Balance] Backend error:', response.status, errData);
      throw new Error(`Failed to fetch balance: ${response.status}`);
    }

    const data = await response.json();

    const wallets: Array<{ balance: number; is_primary: boolean; currency: string }> =
      data?.data?.wallets ?? data?.wallets ?? [];
    const primary = wallets.find((w) => w.is_primary) ?? wallets[0];
    const balance = primary?.balance ?? 0;

    return NextResponse.json({ balance }, { status: 200 });

  } catch (error) {
    console.error('Balance fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance from backend' },
      { status: 500 }
    );
  }
}
