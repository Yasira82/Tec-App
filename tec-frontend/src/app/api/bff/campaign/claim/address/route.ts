import { z } from 'zod';
import { createHandler } from '@/lib/bff/createHandler';

/**
 * Correct the address on a claim that has not been paid yet.
 *
 * Same shape as the claim itself, and the same rule about what is NOT in the
 * payload: the owner is derived from the verified token by the service. A route
 * that could name whose claim to edit is a route that can redirect somebody
 * else's reward.
 *
 * The address is validated properly by the SERVICE — including the Stellar
 * checksum, which is the only thing that catches a typo that would send real Pi
 * to a stranger. This layer only bounds the string (P5: pre-validation, never
 * the authority), and the service is also the one that refuses once the Pi has
 * actually been sent.
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export const PATCH = createHandler({
  requireAuth: true,
  schema: z.object({ wallet_address: z.string().trim().min(1).max(120) }),
  handler: async ({ input, ctx, req }) => {
    const res = await fetch(`${GATEWAY}/api/identity/campaign/claim/address`, {
      method: 'PATCH',
      headers: {
        Authorization:  `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
        'Content-Type': 'application/json',
        'x-request-id': ctx.requestId,
      },
      body:  JSON.stringify({ wallet_address: input.wallet_address }),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // The service's own sentence. It knows which way the address was wrong,
      // and whether the reward has already gone — the two answers a person
      // needs, and both lost behind a generic failure.
      throw Object.assign(new Error(data?.message ?? data?.error ?? 'Could not change the address'), {
        status: res.status,
      });
    }
    return data?.data ?? {};
  },
});
