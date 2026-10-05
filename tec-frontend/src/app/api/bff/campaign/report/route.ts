import { z } from 'zod';
import { createHandler } from '@/lib/bff/createHandler';
import { campaignPost } from '@/lib/bff/campaign-post';

/**
 * Round 3: the report on one assigned app (the form agreed on 2026-10-05) — what
 * happened, a problem yes/no, the problem or what was clear and useful, and an
 * optional suggestion. Declared evidence: the service accepts it only after the
 * app itself reported the pioneer arriving, and an admin reviews it.
 */
export const POST = createHandler({
  requireAuth: true,
  schema: z.object({
    app:         z.string().min(1).max(40),
    observed:    z.string().min(10).max(1000),
    had_problem: z.boolean(),
    detail:      z.string().min(10).max(1000),
    suggestion:  z.string().max(500).optional(),
  }),
  handler: async ({ input, ctx, req }) =>
    campaignPost(
      'report',
      {
        app: input.app, observed: input.observed, had_problem: input.had_problem, detail: input.detail,
        ...(input.suggestion ? { suggestion: input.suggestion } : {}),
      },
      req.cookies.get('tec_access_token')?.value ?? '',
      ctx.requestId,
    ),
});
