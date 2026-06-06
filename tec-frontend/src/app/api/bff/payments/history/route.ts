import { z }             from 'zod';
import { createHandler } from '@/lib/bff/createHandler';

const GW = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? '';

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort:  z.enum(['asc', 'desc']).default('desc'),
});

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const token            = req.cookies.get('tec_access_token')?.value ?? '';
    const { searchParams } = req.nextUrl;
    const { limit, sort }  = QuerySchema.parse({
      limit: searchParams.get('limit'),
      sort:  searchParams.get('sort'),
    });

    const res = await fetch(
      `${GW}/api/payment/history?userId=${ctx.userId}&limit=${limit}&sort=${sort}`,
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
