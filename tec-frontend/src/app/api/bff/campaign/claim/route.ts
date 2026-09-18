import { z }             from 'zod';
import { createHandler } from '@/lib/bff/createHandler';

/**
 * Take a campaign seat.
 *
 * ── The owner is still never sent ──────────────────────────────────────────
 * It comes from the verified token inside the service. A route that decides who
 * gets paid is the last place to let a caller say who that is (P6), and there is
 * no field here that could.
 *
 * ── The address may be, and this is the part that changed ──────────────────
 * It used to be forbidden too, on the grounds that the address was where the Pi
 * went. **It is not any more.** A2U pays a Pi UID and Pi resolves the wallet
 * itself — the recipient comes back FROM Pi, and nothing a caller sends reaches
 * the transfer. So this field cannot redirect a single π; it is the campaign's
 * one-wallet-one-reward key, which a unique constraint in the service enforces.
 *
 * It is a FALLBACK. The service prefers the address posted in the TEC group and
 * reads this one only when there is none — which is the case this exists for:
 * somebody who used the chat exactly as the mission asked and did not paste 56
 * characters into it used to hit a dead end with nothing to do about it.
 *
 * Optional, so a claim from the group route still sends no payload at all.
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export const POST = createHandler({
  requireAuth: true,
  schema: z.object({ wallet_address: z.string().trim().min(1).max(120).optional() }).optional(),
  handler: async ({ input, ctx, req }) => {
    const typed = input?.wallet_address;
    const res = await fetch(`${GATEWAY}/api/identity/campaign/claim`, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
        'x-request-id': ctx.requestId,
        ...(typed ? { 'Content-Type': 'application/json' } : {}),
      },
      // The address is NOT validated here. The service applies the same checksum
      // to both routes, and a second opinion in the BFF is a second place for
      // the rule to drift — see the fleet-wide Pro-detection incident.
      ...(typed ? { body: JSON.stringify({ wallet_address: typed }) } : {}),
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
