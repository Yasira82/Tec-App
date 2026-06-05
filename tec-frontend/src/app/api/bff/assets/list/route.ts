import { createHandler } from '@/lib/bff/createHandler';

interface RawAsset {
  id:        string;
  slug:      string;
  category:  string;
  status:    string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const GATEWAY = process.env.API_GATEWAY_URL ?? process.env.API_GATEWAY_URL ?? '';

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const token = req.cookies.get('tec_access_token')?.value ?? '';

    const res = await fetch(
      `${GATEWAY}/api/assets/user/${encodeURIComponent(ctx.userId)}`,
      {
        headers: {
          Authorization:    `Bearer ${token}`,
          'x-request-id':   ctx.requestId,
          'x-internal-key': process.env.INTERNAL_SECRET ?? '',
        },
        cache: 'no-store',
      },
    );

    if (!res.ok) {
      console.error('[Hub BFF] assets/list failed:', res.status);
      return { data: [], total: 0 }; // ✅ مش بيرمي error
    }

    const raw    = await res.json();
    const assets = (raw?.data ?? []).map((a: RawAsset) => ({
      id:         a.id,
      name:       (a.metadata?.name as string) ?? a.slug, // ✅ الاسم الحقيقي
      asset_type: a.category?.toLowerCase() ?? 'domain',
      value:      a.category?.toLowerCase() === 'nft' ? 2 : 1,
      currency:   'PI',
      status:     a.status?.toLowerCase() ?? 'active',
      created_at: a.createdAt,
      metadata:   a.metadata ?? {},
    }));

    return { data: assets, total: assets.length };
  },
});
