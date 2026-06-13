import { NextRequest, NextResponse } from 'next/server';
import { isE2eMode }         from '@/lib/server/e2e-mode';
import { fetchWithTimeout }  from '@/lib/server/fetch-with-timeout';

const GATEWAY = process.env.API_GATEWAY_URL ?? '';

function getUserIdFromCookie(req: NextRequest): string | null {
  try {
    const raw = req.cookies.get('tec_user')?.value;
    if (!raw) return null;
    const user = JSON.parse(decodeURIComponent(raw));
    return user?.id ?? user?.uid ?? null;
  } catch { return null; }
}

interface Wallet {
  id:             string;
  balance:        number;
  currency:       string;
  wallet_type:    string;
  wallet_address: string | null;
  is_primary:     boolean;
  updated_at:     string;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isE2eMode()) {
    return NextResponse.json({ balance: 0, currency: 'PI', address: null, walletId: null });
  }

  const userId = getUserIdFromCookie(req) || req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  try {
    const res = await fetchWithTimeout(
      `${GATEWAY}/api/wallets?userId=${encodeURIComponent(userId)}`,
      {
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        cache:   'no-store',
      },
    );

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error('[wallet/balance] Gateway error:', res.status, JSON.stringify(errBody));
      return NextResponse.json({ balance: '0', currency: 'PI', address: null, walletId: null });
    }

    const data    = await res.json().catch(() => ({}));
    const wallets: Wallet[] = data?.wallets ?? data?.data?.wallets ?? [];

    // ✅ PI wallet الأحدث (is_primary + updated_at)
    const piWallets = wallets.filter(w => w.currency === 'PI');
    const primary   = piWallets
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .find(w => w.is_primary) ?? piWallets[0] ?? wallets[0];

    return NextResponse.json({
      balance:  primary?.balance ?? '0',
      currency: primary?.currency       ?? 'PI',
      address:  primary?.wallet_address ?? null,
      walletId: primary?.id             ?? null,
    });
  } catch (err) {
    console.error('[wallet/balance] Exception:', (err as Error).message);
    return NextResponse.json({ balance: '0', currency: 'PI', address: null, walletId: null });
  }
}
