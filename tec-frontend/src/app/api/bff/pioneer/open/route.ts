import { z } from 'zod';
import { createHandler } from '@/lib/bff/createHandler';

// POST /api/bff/pioneer/open — record that the caller opened an app (ticks their
// Pioneer Quest, and grants the Founding number on completion). The owner is the
// VERIFIED session identity: the backend derives it from the forwarded JWT, never
// the body (P6). Requires auth — a logged-out visitor's progress stays local-only.
// NEW-A: gateway URL is server-only.
const GW = process.env.API_GATEWAY_URL ?? '';

export const POST = createHandler({
  requireAuth: true,
  schema: z.object({ app: z.string().min(1).max(40), source: z.string().max(200).optional() }),
  handler: async ({ input, ctx, req }) => {
    const token = req.cookies.get('tec_access_token')?.value ?? '';
    const res = await fetch(`${GW}/api/identity/pioneer/open`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-request-id': ctx.requestId,
      },
      body: JSON.stringify({ app: input.app, ...(input.source ? { source: input.source } : {}) }),
    });
    if (!res.ok) throw new Error(`Gateway ${res.status}`);
    return res.json();
  },
});
