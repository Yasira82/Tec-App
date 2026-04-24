import { createHandler } from '@/lib/bff/createHandler';

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    // ✅ مرّر الـ cookie للـ Gateway
    const cookie = req.headers.get('cookie') ?? '';

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/wallet/balance?userId=${ctx.userId}`,
      {
        headers: {
          'cookie':       cookie,
          'x-request-id': ctx.requestId,
        },
        cache: 'no-store',
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gateway error ${res.status}: ${text}`);
    }
    return res.json();
  },
});
