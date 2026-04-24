import { createHandler } from '@/lib/bff/createHandler';

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const token      = req.cookies.get('tec_access_token')?.value ?? '';
    const gatewayUrl = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

    // ✅ الـ path الصح — نفس الـ route القديم
    const res = await fetch(
      `${gatewayUrl}/api/wallets?userId=${encodeURIComponent(ctx.userId)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-request-id':  ctx.requestId,
        },
        cache: 'no-store',
      },
    );

    if (!res.ok) {
      return { balance: 0, currency: 'PI', address: null, walletId: null };
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
      balance:  primary ? Number(primary.balance) : 0,
      currency: primary?.currency       ?? 'PI',
      address:  primary?.wallet_address ?? null,
      walletId: primary?.id             ?? null,
    };
  },
});
