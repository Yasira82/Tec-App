import { z } from 'zod';
import { createHandler } from '@/lib/bff/createHandler';
import { campaignPost } from '@/lib/bff/campaign-post';

/**
 * Round 3: choose 1 to 3 of the round's apps (KB ROUND_3_DISCOVERY_DECISION §4).
 * The service checks the list against the launch set; this only bounds the shape.
 */
export const POST = createHandler({
  requireAuth: true,
  schema: z.object({ apps: z.array(z.string().min(1).max(40)).min(1).max(3) }),
  handler: async ({ input, ctx, req }) =>
    campaignPost('pick', { apps: input.apps }, req.cookies.get('tec_access_token')?.value ?? '', ctx.requestId),
});
