import { z } from 'zod';
import { createHandler } from '@/lib/bff/createHandler';
import { campaignPost } from '@/lib/bff/campaign-post';

/**
 * Round 3: swap one assigned app that will not work for this pioneer. The reason
 * is required — it is evidence about that app — and the service bounds the swaps.
 */
export const POST = createHandler({
  requireAuth: true,
  schema: z.object({ app: z.string().min(1).max(40), reason: z.string().min(10).max(1000) }),
  handler: async ({ input, ctx, req }) =>
    campaignPost('swap', { app: input.app, reason: input.reason }, req.cookies.get('tec_access_token')?.value ?? '', ctx.requestId),
});
