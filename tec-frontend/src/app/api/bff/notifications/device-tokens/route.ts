import { z }             from 'zod';
import { createHandler } from '@/lib/bff/createHandler';

const GW = process.env.API_GATEWAY_URL ?? '';

export const POST = createHandler({
  requireAuth: true,
  schema: z.object({
    token:    z.string().min(1),
    platform: z.string().min(1),
  }),
  handler: async ({ input, ctx, req }) => {
    const accessToken = req.cookies.get('tec_access_token')?.value ?? '';

    const res = await fetch(
      `${GW}/api/notification/device-tokens`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type':  'application/json',
          'x-request-id':  ctx.requestId,
        },
        body: JSON.stringify({ ...input, userId: ctx.userId }),
      },
    );

    if (!res.ok) throw Object.assign(new Error(`Gateway ${res.status}`), { status: res.status });
    return res.json();
  },
});
