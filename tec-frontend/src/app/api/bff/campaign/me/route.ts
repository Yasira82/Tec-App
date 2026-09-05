import { createHandler } from '@/lib/bff/createHandler';

// This pioneer's campaign progress + their claim, if any. Owner is the verified
// session, resolved by the service from the token — never a body or query field.
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const res = await fetch(`${GATEWAY}/api/identity/campaign/me`, {
      headers: {
        Authorization:  `Bearer ${req.cookies.get('tec_access_token')?.value ?? ''}`,
        'x-request-id': ctx.requestId,
      },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error('Could not load your campaign progress'), { status: res.status });
    return data?.data ?? {};
  },
});
