import { createHandler } from '@/lib/bff/createHandler';

// GET /api/bff/pioneer/me — the caller's OWN Pioneer Quest (progress + Founding
// number). The owner is resolved from the VERIFIED JWT by identity-service, never a
// client-supplied value — so we forward ONLY the token (no owner param). This closes
// the previous IDOR where the owner came from the tamperable `tec_user` cookie.
// Requires auth; a logged-out visitor never reaches here. NEW-A: gateway URL server-only.
const GW = process.env.API_GATEWAY_URL ?? '';

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const token = req.cookies.get('tec_access_token')?.value ?? '';
    const res = await fetch(`${GW}/api/identity/pioneer/me`, {
      headers: { Authorization: `Bearer ${token}`, 'x-request-id': ctx.requestId },
      cache:   'no-store',
    });
    if (!res.ok) throw new Error(`Gateway ${res.status}`);
    return res.json();
  },
});
