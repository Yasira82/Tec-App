import { z } from 'zod';
import { createHandler } from '@/lib/bff/createHandler';

/**
 * "Why did you stop?" — one of five reasons and an optional note (the Round 3
 * decision, KB audits/ROUND_3_DISCOVERY_DECISION_2026-10-04.md).
 *
 * The owner is the verified token, read by the SERVICE — this route sends no name.
 * The answer is what the pioneer SAID; the service stores it as declared, never as
 * a verified fact, and refuses it once they have claimed.
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export const POST = createHandler({
  requireAuth: true,
  schema: z.object({
    reason: z.enum(['a', 'b', 'c', 'd', 'e']),
    note:   z.string().max(280).optional(),
  }),
  handler: async ({ input, ctx, req }) => {
    const res = await fetch(`${GATEWAY}/api/identity/campaign/stop-reason`, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
        'Content-Type': 'application/json',
        'x-request-id': ctx.requestId,
      },
      body:  JSON.stringify({ reason: input.reason, note: input.note }),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw Object.assign(new Error(data?.message ?? data?.error ?? 'Could not save your answer'), { status: res.status });
    }
    return data?.data ?? {};
  },
});
