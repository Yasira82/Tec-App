import { createHandler } from '@/lib/bff/createHandler';
import { buildHeaders }  from '@/lib/request-id';
import { getAccessToken } from '@/lib-client/pi/pi-auth';

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx }) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/assets?userId=${ctx.userId}`,
      {
        headers: {
          ...buildHeaders(getAccessToken()),
          'x-user-id': ctx.userId,
        },
        cache: 'no-store',
      },
    );

    if (!res.ok) throw new Error('Failed to fetch assets');
    return res.json();
  },
});
