import { createHandler } from '@/lib/bff/createHandler';

const GW = process.env.API_GATEWAY_URL ?? '';

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) => {
    const token = req.cookies.get('tec_access_token')?.value ?? '';

    // NEW-R: the notification-service has NO /unread-count route (it 404'd).
    // The base GET /notifications already returns { data: { notifications, unreadCount } }.
    // Use it and surface just the count.
    const res = await fetch(
      `${GW}/api/notification?userId=${ctx.userId}&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-request-id':  ctx.requestId,
        },
        cache: 'no-store',
      },
    );

    if (!res.ok) throw Object.assign(new Error(`Gateway ${res.status}`), { status: res.status });
    const data = await res.json().catch(() => ({}));
    const unreadCount = data?.data?.unreadCount ?? data?.unreadCount ?? 0;
    return { success: true, data: { unreadCount } };
  },
});
