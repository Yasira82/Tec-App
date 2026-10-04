import { z } from 'zod';
import { createHandler } from '@/lib/bff/createHandler';
import { campaignPost } from '@/lib/bff/campaign-post';

/**
 * Round 3: "If your phone were lost today, would your Pi be safe?" — three fixed
 * answers, once. There is no text field anywhere on this path, so nothing about
 * a passphrase can be sent (C-106 §10a).
 */
export const POST = createHandler({
  requireAuth: true,
  schema: z.object({ answer: z.enum(['yes', 'no', 'not_sure']) }).strict(),
  handler: async ({ input, ctx, req }) =>
    campaignPost('continuity', { answer: input.answer }, req.cookies.get('tec_access_token')?.value ?? '', ctx.requestId),
});
