import { z }              from 'zod';
import { createHandler }  from '@/lib/bff/createHandler';
import { buildHeaders }   from '@/lib/request-id';
import { getAccessToken } from '@/lib-client/pi/pi-auth';

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const { searchParams } = req.nextUrl;
    const limit = Math.min(Number(searchParams.get('limit') ?? 20), 50);
    const page  = Math.max(Number(searchParams.get('page')  ?? 1),  1);

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/notifications?userId=${ctx.userId}&limit=${limit}&page=${page}`,
      {
        headers: buildHeaders(getAccessToken()),
        cache:   'no-store',
      },
    );
    if (!res.ok) throw new Error('Failed to fetch notifications');
    return res.json();
  },
});

export const PATCH = createHandler({
  requireAuth: true,
  schema: z.object({
    notificationId: z.string().optional(),
    markAll:        z.boolean().optional(),
  }),
  handler: async ({ input, ctx }) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/notifications/read`,
      {
        method:  'PATCH',
        headers: { ...buildHeaders(getAccessToken()), 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...input, userId: ctx.userId }),
      },
    );
    if (!res.ok) throw new Error('Failed to mark notifications');
    return res.json();
  },
});
