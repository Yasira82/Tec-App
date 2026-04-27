import { createHandler } from '@/lib/bff/createHandler';

interface RawAsset {
  id:        string;
  slug:      string;
  category:  string;
  status:    string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const GATEWAY =
  process.env.API_GATEWAY_URL ??
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ??
  'https://api-gateway-production-6a68.up.railway.app';

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const token = req.cookies.get('tec_access_token')?.value ?? '';

    const url = `${GATEWAY}/api/assets/user/${encodeURIComponent(ctx.userId)}`;

    const res = await fetch(url, {
      headers: {
        'Authorization':  `Bearer ${token}`,
        'x-request-id':   ctx.requestId,
        'x-internal-key': process.env.INTERNAL_SECRET ?? '', // ✅
      },
      cache: 'no-store',
    });

    if (!res.ok) throw new Error(`Gateway ${res.status}`);

    const raw    = await res.json();
    const assets = (raw?.data ?? []).map((a: RawAsset) => ({
      id:         a.id,
      name:       a.slug,
      asset_type: a.category?.toLowerCase() ?? 'domain',
      value:      0,
      currency:   'PI',
      status:     a.status?.toLowerCase() ?? 'active',
      created_at: a.createdAt,
    }));

    return { data: assets, total: assets.length };
  },
});
