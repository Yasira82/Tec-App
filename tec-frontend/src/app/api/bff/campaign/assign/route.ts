import { createHandler } from '@/lib/bff/createHandler';
import { campaignPost } from '@/lib/bff/campaign-post';

/**
 * Round 3: the service assigns this pioneer's 3 apps (KB ROUND_3_DISCOVERY_DECISION §4b).
 * Nothing is chosen here — the body is empty; the session says who is asking.
 */
export const POST = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) =>
    campaignPost('assign', {}, req.cookies.get('tec_access_token')?.value ?? '', ctx.requestId),
});
