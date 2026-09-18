import { z } from 'zod';
import { createHandler } from '@/lib/bff/createHandler';
import { LIVE_DOMAINS } from '@/domains/_registry';

// POST /api/bff/pioneer/open — record that the caller opened an app (ticks their
// Pioneer Quest, and grants the Founding number on completion). The owner is the
// VERIFIED session identity: the backend derives it from the forwarded JWT, never
// the body (P6). Requires auth — a logged-out visitor's progress stays local-only.
// NEW-A: gateway URL is server-only.
const GW = process.env.API_GATEWAY_URL ?? '';

/**
 * The apps the Quest counts, from the Hub's own live registry.
 *
 * A pre-check, not the gate. `app` used to be any string up to 40 characters, so
 * twenty-four POSTs carrying 'a'..'x' completed the Quest and took a permanent
 * Founding number without opening anything. The REAL refusal now lives in
 * identity-service, which keeps its own fixed roster — this only turns a
 * meaningless slug into an immediate, readable 400 instead of a gateway round
 * trip (P5: pre-validation, never the authority).
 *
 * The two lists agree today. If they ever diverge the service wins, which is the
 * correct outcome: a live campaign's terms are the campaign's to define, and the
 * registry changes whenever an app ships.
 */
const LIVE_SLUGS = new Set(LIVE_DOMAINS.map((d) => d.slug));

export const POST = createHandler({
  requireAuth: true,
  schema: z.object({
    app: z.string().trim().toLowerCase().refine((s) => LIVE_SLUGS.has(s), {
      message: 'Unknown app',
    }),
    source: z.string().max(200).optional(),
  }),
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
    if (!res.ok) throw Object.assign(new Error(`Gateway ${res.status}`), { status: res.status });
    return res.json();
  },
});
