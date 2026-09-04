import { z } from 'zod';
import { createHandler } from '@/lib/bff/createHandler';

/**
 * Feedback → the feedback module in `tec-identity-service`, via the gateway.
 *
 * One inbox for the whole fleet: Life posts here with `app: 'life'`, the Hub
 * with `app: 'hub'`. The AUTHOR is the verified session identity, resolved
 * server-side by the service from the token — never anything the caller sent.
 */

/**
 * The app label is set HERE and the client's is discarded.
 *
 * Nothing is authorized on it — a wrong one is a mislabelled row, not a
 * security event — but a label anyone can set is a label nobody can sort by,
 * and sorting is the only reason the field exists.
 */
const APP = 'hub';

const SubmitSchema = z.object({
  // Mirrors the service's own bounds so an over-long message is refused before
  // the gateway hop. The SERVICE stays the authority (P5 — pre-validation
  // never weakens what is downstream of it).
  message: z.string().trim().min(3).max(2000),
  // Which screen they were on. Optional: insisting on it would make the form
  // heavier than the thing it collects.
  page: z.string().max(120).optional(),
});

const gateway = () => process.env.API_GATEWAY_URL ?? '';

export const POST = createHandler({
  requireAuth: true,
  schema: SubmitSchema,
  handler: async ({ input, ctx, req }) => {
    const res = await fetch(`${gateway()}/api/identity/feedback`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
        'Content-Type':  'application/json',
        'x-request-id':  ctx.requestId,
      },
      // `app` last, so a client that sent one cannot override it.
      body: JSON.stringify({ ...input, app: APP }),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Carry the service's own sentence. It knows which rule was broken, and
      // the hourly limit in particular is not something the client can see —
      // inventing a generic failure here would hide the only useful line.
      throw Object.assign(new Error(data?.message ?? data?.error ?? 'Could not send'), {
        status: res.status,
      });
    }
    return data?.data ?? data;
  },
});

/** The caller's OWN messages — so a person can see that theirs landed. */
export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const res = await fetch(`${gateway()}/api/identity/feedback/mine`, {
      headers: {
        'Authorization': `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
        'x-request-id':  ctx.requestId,
      },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    // A list that cannot be loaded is an empty list on screen, not a broken
    // page — the form above it must stay usable.
    if (!res.ok) return { feedback: [] };
    return data?.data ?? { feedback: [] };
  },
});
