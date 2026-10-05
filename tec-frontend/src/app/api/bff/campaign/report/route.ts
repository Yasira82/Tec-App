import { z } from 'zod';
import { createHandler } from '@/lib/bff/createHandler';
import { campaignPost } from '@/lib/bff/campaign-post';

/**
 * Round 3: what the pioneer found in one of their apps, and an optional suggestion
 * for it. Declared evidence — the service accepts it only after the app itself
 * reported the pioneer arriving.
 */
export const POST = createHandler({
  requireAuth: true,
  schema: z.object({
    app:        z.string().min(1).max(40),
    report:     z.string().min(10).max(1000),
    suggestion: z.string().max(500).optional(),
  }),
  handler: async ({ input, ctx, req }) =>
    campaignPost(
      'report',
      { app: input.app, report: input.report, ...(input.suggestion ? { suggestion: input.suggestion } : {}) },
      req.cookies.get('tec_access_token')?.value ?? '',
      ctx.requestId,
    ),
});
