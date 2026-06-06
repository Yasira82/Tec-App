import { z }             from 'zod';
import { createHandler } from '@/lib/bff/createHandler';

const GW = process.env.API_GATEWAY_URL ?? '';

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const token = req.cookies.get('tec_access_token')?.value ?? '';

    const res = await fetch(
      `${GW}/api/identity/profile?userId=${ctx.userId}`,
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
    displayName: z.string().min(1).max(50).optional(),
    bio:         z.string().max(200).optional(),
    avatar:      z.string().url().optional(),
  }),
  handler: async ({ input, ctx, req }) => {
    const token = req.cookies.get('tec_access_token')?.value ?? '';

    const res = await fetch(
      `${GW}/api/identity/profile`,
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
