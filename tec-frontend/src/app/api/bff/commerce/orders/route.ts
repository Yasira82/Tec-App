import { z }             from 'zod';
import { createHandler } from '@/lib/bff/createHandler';

const GW = process.env.API_GATEWAY_URL
        ?? process.env.NEXT_PUBLIC_API_GATEWAY_URL
        ?? '';

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const token            = req.cookies.get('tec_access_token')?.value ?? '';
    const { searchParams } = req.nextUrl;
    const limit = Math.min(Number(searchParams.get('limit') ?? 10), 50);
    const sort  = searchParams.get('sort') ?? 'desc';

    const res = await fetch(
      `${GW}/api/commerce/orders?userId=${ctx.userId}&limit=${limit}&sort=${sort}`,
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

export const POST = createHandler({
  requireAuth: true,
  requireKYC:  true,
  schema: z.object({
    items: z.array(z.object({
      productId: z.string(),
      qty:       z.number().int().min(1),
    })).min(1),
    memo: z.string().optional(),
  }),
  handler: async ({ input, ctx, req }) => {
    const token = req.cookies.get('tec_access_token')?.value ?? '';

    const res = await fetch(
      `${GW}/api/commerce/orders`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'application/json',
          'x-request-id':  ctx.requestId,
        },
        body: JSON.stringify({ ...input, userId: ctx.userId }),
      },
    );

    if (!res.ok) throw new Error(`Gateway ${res.status}`);
    return res.json();
  },
});
