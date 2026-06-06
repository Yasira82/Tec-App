import { createHandler } from '@/lib/bff/createHandler';

const GW = process.env.API_GATEWAY_URL ?? '';

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const token = req.cookies.get('tec_access_token')?.value ?? '';

    const res = await fetch(
      `${GW}/api/kyc/status?userId=${ctx.userId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-request-id':  ctx.requestId,
        },
        cache: 'no-store',
      },
    );

    if (!res.ok) throw new Error(`Gateway ${res.status}`);
    return res.json();
  },
});
