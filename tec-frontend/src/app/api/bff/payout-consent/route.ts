import { createHandler } from '@/lib/bff/createHandler';

/**
 * Does this account still need to sign in again before it can be paid?
 *
 * ── Why this route exists ───────────────────────────────────────────────────
 * Pi resolves a `uid` to a wallet only for an app the person granted
 * `wallet_address`, and **Pi cannot widen a consent already given**. The Hub
 * only began requesting that scope on 2026-09-13, so every account that signed
 * in before it must sign in once more — and the Hub's home screen advertises a
 * reward it cannot pay them until they do.
 *
 * Nothing told them. `/api/auth/me` cannot: it reads the `tec_user` cookie,
 * which was written at login and therefore says nothing about an account that
 * has not logged in since. The answer lives on the auth-service row, so this
 * asks for it.
 *
 * ── Fail OPEN, deliberately ────────────────────────────────────────────────
 * If auth cannot be reached, this returns `needsReconsent: false` — no banner.
 * That is the opposite of the platform's usual P6 default, and it is correct
 * here: the failure mode of a wrong answer is a NAG, not an exposure. Nothing
 * is authorized by this route, no data is revealed by it, and a banner that
 * appears because a service blipped is a banner people learn to dismiss
 * without reading. When it matters (the payout itself) the real gate is Pi's
 * own refusal, which the campaign already records and surfaces.
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    try {
      const res = await fetch(`${GATEWAY}/api/v1/auth/me`, {
        headers: {
          Authorization:  `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
          'x-request-id': ctx.requestId,
        },
        cache: 'no-store',
      });
      if (!res.ok) return { needsReconsent: false };

      const body = await res.json().catch(() => ({}));
      // Auth derives the flag so nothing here has to know which scope the
      // payout path needs, or that an empty list means unknown.
      const me = (body?.data ?? body) as { needs_payout_reconsent?: unknown };
      return { needsReconsent: me?.needs_payout_reconsent === true };
    } catch {
      return { needsReconsent: false };
    }
  },
});
