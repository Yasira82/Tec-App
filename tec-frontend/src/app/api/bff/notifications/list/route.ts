import { z }             from 'zod';
import { createHandler } from '@/lib/bff/createHandler';

const GW = process.env.API_GATEWAY_URL ?? '';

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const token            = req.cookies.get('tec_access_token')?.value ?? '';
    const { searchParams } = req.nextUrl;
    const limit = Math.min(Number(searchParams.get('limit') ?? 20), 50);
    const page  = Math.max(Number(searchParams.get('page')  ?? 1),  1);

    const res = await fetch(
      `${GW}/api/notification?userId=${ctx.userId}&limit=${limit}&page=${page}`,
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

export const PATCH = createHandler({
  requireAuth: true,
  schema: z.object({
    notificationId: z.string().optional(),
    markAll:        z.boolean().optional(),
  }),
  handler: async ({ input, ctx, req }) => {
    const token = req.cookies.get('tec_access_token')?.value ?? '';

    const res = await fetch(
      `${GW}/api/notification/read`,
      {
        method:  'PATCH',
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
