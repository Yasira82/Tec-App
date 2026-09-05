import { z } from 'zod';
import { createHandler } from '@/lib/bff/createHandler';

/**
 * Take a campaign seat and say where to send the Pi.
 *
 * The address is validated properly by the SERVICE — including the Stellar
 * checksum, which is the only thing that catches a typo that would send real Pi
 * to a stranger. This layer only bounds the string so a megabyte never reaches
 * the gateway (P5: pre-validation, never the authority).
 *
 * The claim's owner is NOT in this payload and must never be: the service
 * derives it from the verified token. A route that decides who gets paid is the
 * last place to let the caller say who that is.
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export const POST = createHandler({
  requireAuth: true,
  schema: z.object({ wallet_address: z.string().trim().min(1).max(120) }),
  handler: async ({ input, ctx, req }) => {
    const res = await fetch(`${GATEWAY}/api/identity/campaign/claim`, {
      method: 'POST',
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
      // Carry the service's own sentence. It knows WHICH way the address was
      // wrong, or which app is still missing — inventing a generic failure here
      // would hide the only line the person can act on.
      throw Object.assign(new Error(data?.message ?? data?.error ?? 'Could not claim'), {
        status: res.status,
      });
    }
    return data?.data ?? {};
  },
});
