import { z }              from 'zod';
import { createHandler }  from '@/lib/bff/createHandler';
import { buildHeaders }   from '@/lib/request-id';
import { getAccessToken } from '@/lib-client/pi/pi-auth';

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx }) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/commerce/orders?userId=${ctx.userId}&limit=10&sort=desc`,
      {
        headers: buildHeaders(getAccessToken()),
        cache:   'no-store',
      },
    );
    if (!res.ok) throw new Error('Failed to fetch orders');
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
  handler: async ({ input, ctx }) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/commerce/orders`,
      {
        method:  'POST',
        headers: { ...buildHeaders(getAccessToken()), 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...input, userId: ctx.userId }),
      },
    );
    if (!res.ok) throw new Error('Failed to create order');
    return res.json();
  },
});
