import { createHandler } from '@/lib/bff/createHandler';

/**
 * Take a campaign seat.
 *
 * There is no payload at all, and that is the design. Neither the owner NOR the
 * payout address is sent: the service derives the owner from the verified token
 * and reads the address out of the pioneer's own message in the TEC group.
 *
 * A route that decides who gets paid, and where, is the last place to let a
 * caller say either (P6). Removing the field removes the question — and it also
 * removed the step people abandoned, which was typing 56 characters copied from
 * a wallet app into a browser on a phone.
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export const POST = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const res = await fetch(`${GATEWAY}/api/identity/campaign/claim`, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
        'x-request-id': ctx.requestId,
      },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Carry the service's own sentence. It knows whether an address was never
      // posted, could not be read, or is already spent — inventing a generic
      // failure here would hide the only line the person can act on.
      throw Object.assign(new Error(data?.message ?? data?.error ?? 'Could not claim'), {
        status: res.status,
      });
    }
    return data?.data ?? {};
  },
});

/**
 * Give the seat back.
 *
 * No body, and deliberately no claim id: like every other route here, WHOSE
 * claim this is comes from the verified token inside the service. An id in the
 * payload would be an id somebody could change.
 *
 * The service refuses once the Pi has been sent — a paid claim is the record of
 * where money went, and that is not the claimant's to erase.
 */
export const DELETE = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const res = await fetch(`${GATEWAY}/api/identity/campaign/claim`, {
      method: 'DELETE',
      headers: {
        Authorization:  `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
        'x-request-id': ctx.requestId,
      },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw Object.assign(new Error(data?.message ?? data?.error ?? 'Could not cancel the claim'), {
        status: res.status,
      });
    }
    return data?.data ?? {};
  },
});
