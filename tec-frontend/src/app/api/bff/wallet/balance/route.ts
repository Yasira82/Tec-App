import { createHandler } from '@/lib/bff/createHandler';
import { NextResponse }  from 'next/server';

const fetchWallet = async (token: string, userId: string, requestId: string, gatewayUrl: string) =>
  fetch(`${gatewayUrl}/api/wallets?userId=${encodeURIComponent(userId)}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'x-request-id': requestId },
    cache: 'no-store',
  });

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const gatewayUrl = process.env.API_GATEWAY_URL ?? '';
    let token        = req.cookies.get('tec_access_token')?.value ?? '';

    let res = await fetchWallet(token, ctx.userId, ctx.requestId, gatewayUrl);

    // ✅ Token expired → auto refresh
    if (res.status === 401) {
      const errData = await res.json().catch(() => ({}));
      if (errData?.error?.code === 'TOKEN_EXPIRED') {
        const refreshRes = await fetch(`${req.nextUrl.origin}/api/auth/refresh`, {
          method:  'POST',
          headers: {
            'Cookie':        req.headers.get('cookie') ?? '',
            'x-csrf-token':  req.cookies.get('tec_csrf')?.value ?? '',
            'Content-Type':  'application/json',
          },
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json().catch(() => ({}));
          const newToken    = refreshData.token ?? '';
          if (newToken) {
            token = newToken;
            res   = await fetchWallet(token, ctx.userId, ctx.requestId, gatewayUrl);
          }
        }
      }
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const code    = errData?.error?.code;
      // ✅ ابعت 401 للـ client لو TOKEN_EXPIRED بعد الـ refresh
      if (code === 'TOKEN_EXPIRED') {
        return NextResponse.json({ error: 'TOKEN_EXPIRED' }, { status: 401 });
      }
      return { balance: '0', currency: 'PI', address: null, walletId: null };
    }

    const data = await res.json().catch(() => ({}));

    interface Wallet {
      id:             string;
      balance:        number;
      currency:       string;
      is_primary:     boolean;
      wallet_address: string | null;
      updated_at:     string;
    }

    const wallets: Wallet[] = data?.wallets ?? data?.data?.wallets ?? [];
    const piWallets = wallets.filter((w: Wallet) => w.currency === 'PI');
    const primary   = piWallets
      .sort((a: Wallet, b: Wallet) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )
      .find((w: Wallet) => w.is_primary) ?? piWallets[0] ?? wallets[0];

    return {
      balance:  primary?.balance?.toString() ?? '0',
      currency: primary?.currency       ?? 'PI',
      address:  primary?.wallet_address ?? null,
      walletId: primary?.id             ?? null,
    };
  },
});
