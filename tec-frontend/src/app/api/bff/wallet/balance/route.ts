import { createHandler, AppError } from '@/lib/bff/createHandler';
import { gatewayFetch } from '@/lib/gateway-fetch';
import { z } from 'zod';
import { log } from '@/lib/observability';

// What wallet-service answers for GET /wallets?userId= (getWalletsInternal): the rows,
// balance a DECIMAL — a string on the wire (ADR-009), a number from older builds.
// Checked here, at the edge (TEC-AUDIT-0034): this route used to answer
// `{ balance: '0' }` with a 200 when the wallet service failed OR answered something
// unreadable — and every screen that shows the balance had been written to say
// "unavailable, retry" on an error and "never fabricate a 0 balance" (C-135 §4). The
// route fabricated it for them. An empty list is the one honest zero: no wallet yet.
const Decimal = z.union([z.string().regex(/^\d+(\.\d+)?$/), z.number().finite().nonnegative()]);
const WalletRow = z.object({
  id:             z.string(),
  balance:        Decimal,
  currency:       z.string(),
  is_primary:     z.boolean(),
  wallet_address: z.string().nullable().optional(),
  updated_at:     z.string(),
});
type Wallet = z.infer<typeof WalletRow>;
const WalletsAnswer = z.union([
  z.object({ wallets: z.array(WalletRow) }),
  z.object({ data: z.object({ wallets: z.array(WalletRow) }) }),
]);

const fetchWallet = async (token: string, userId: string, requestId: string, gatewayUrl: string) =>
  gatewayFetch(`${gatewayUrl}/api/wallets?userId=${encodeURIComponent(userId)}`, {
    headers: {
      'Authorization':   `Bearer ${token}`,
      'x-request-id':    requestId,
      ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
    },
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
      // The session is not good (after the refresh above): say so — the client signs in again.
      // (A NextResponse returned from a createHandler handler is serialised into a 200 —
      // the old TOKEN_EXPIRED branch reached the browser as "200 OK"; AppError carries the status.)
      if (res.status === 401) {
        throw new AppError('Session expired', 401, code === 'TOKEN_EXPIRED' ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED');
      }
      log.warn('wallet.balance.unavailable', { status: res.status, requestId: ctx.requestId });
      throw new AppError('The wallet service is not answering', 503, 'WALLET_UNAVAILABLE');
    }

    const parsed = WalletsAnswer.safeParse(await res.json().catch(() => null));
    if (!parsed.success) {
      log.error('wallet.balance.unreadable', {
        requestId: ctx.requestId,
        issues:    parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`),
      });
      throw new AppError('The wallet service answered something unreadable', 502, 'WALLET_UNREADABLE');
    }
    const wallets: Wallet[] = 'wallets' in parsed.data ? parsed.data.wallets : parsed.data.data.wallets;

    const piWallets = wallets.filter((w) => w.currency === 'PI');
    const primary   = [...piWallets]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .find((w) => w.is_primary) ?? piWallets[0] ?? wallets[0];

    return {
      balance:  primary ? String(primary.balance) : '0',
      currency: primary?.currency       ?? 'PI',
      address:  primary?.wallet_address ?? null,
      walletId: primary?.id             ?? null,
    };
  },
});
