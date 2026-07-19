import { createHandler } from '@/lib/bff/createHandler';

// GET /api/bff/pioneer/stats — public honest campaign counter (real Founding spots
// claimed / remaining). The /pioneers page is public, so this is unauthenticated;
// it degrades gracefully (success:false) if the backend is unreachable — the page
// then simply omits the live counter. NEW-A: gateway URL is server-only.
const GW = process.env.API_GATEWAY_URL ?? '';

export const GET = createHandler({
  requireAuth: false,
  handler: async ({ req }) => {
    try {
      const res = await fetch(`${GW}/api/identity/pioneer/stats`, {
        headers: { 'x-request-id': req.headers.get('x-request-id') ?? crypto.randomUUID() },
        cache:   'no-store',
      });
      if (!res.ok) return { success: false };
      return res.json();
    } catch {
      return { success: false };
    }
  },
});
