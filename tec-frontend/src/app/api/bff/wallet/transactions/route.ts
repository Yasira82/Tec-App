import { createHandler } from '@/lib/bff/createHandler';

const GW = process.env.API_GATEWAY_URL ?? '';

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const token    = req.cookies.get('tec_access_token')?.value ?? '';
    const walletId = req.nextUrl.searchParams.get('walletId');
    const page     = req.nextUrl.searchParams.get('page')  ?? '1';
    const limit    = req.nextUrl.searchParams.get('limit') ?? '20';
    const status   = req.nextUrl.searchParams.get('status');

    if (!walletId) throw new Error('walletId required');

    const params = new URLSearchParams({ page, limit });
    if (status) params.set('status', status);

    const res = await fetch(
      `${GW}/api/wallets/${encodeURIComponent(walletId)}/transactions?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'application/json',
          'x-request-id':  ctx.requestId,
        },
        cache: 'no-store',
      },
    );

    if (!res.ok) throw Object.assign(new Error(`Gateway ${res.status}`), { status: res.status });
    return res.json();
  },
});
