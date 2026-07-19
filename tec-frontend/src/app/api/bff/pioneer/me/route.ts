import { NextRequest } from 'next/server';
import { createHandler } from '@/lib/bff/createHandler';

// GET /api/bff/pioneer/me — the caller's OWN Pioneer Quest (progress + Founding
// number). Owner is derived from the `tec_user` session cookie server-side (P6 —
// never a client param). Requires auth; a logged-out visitor never reaches here.
// NEW-A: gateway URL is server-only.
const GW = process.env.API_GATEWAY_URL ?? '';

function ownerFromSession(req: NextRequest): string | null {
  try {
    const raw = req.cookies.get('tec_user')?.value ?? '';
    if (!raw) return null;
    let u: Record<string, unknown>;
    try { u = JSON.parse(raw); } catch { u = JSON.parse(decodeURIComponent(raw)); }
    const owner = (u.piUsername ?? u.username) as string | undefined;
    return owner && owner.trim() ? owner.trim() : null;
  } catch { return null; }
}

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const token = req.cookies.get('tec_access_token')?.value ?? '';
    const owner = ownerFromSession(req);
    if (!owner) return { success: true, data: { quest: null } };

    const res = await fetch(
      `${GW}/api/identity/pioneer/me/by-owner/${encodeURIComponent(owner)}`,
      {
        headers: { Authorization: `Bearer ${token}`, 'x-request-id': ctx.requestId },
        cache:   'no-store',
      },
    );
    if (!res.ok) throw new Error(`Gateway ${res.status}`);
    return res.json();
  },
});
