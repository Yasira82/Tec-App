import { z }              from 'zod';
import { createHandler }  from '@/lib/bff/createHandler';
import { buildHeaders }   from '@/lib/request-id';
import { getAccessToken } from '@/lib-client/pi/pi-auth';

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort:  z.enum(['asc', 'desc']).default('desc'),
});

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const { searchParams } = req.nextUrl;
    const { limit, sort }  = QuerySchema.parse({
      limit: searchParams.get('limit'),
      sort:  searchParams.get('sort'),
    });

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/payments/history?userId=${ctx.userId}&limit=${limit}&sort=${sort}`,
      {
        headers: buildHeaders(getAccessToken()),
        cache:   'no-store',
      },
    );
    if (!res.ok) throw new Error('Failed to fetch payment history');
    return res.json();
  },
});
