import { z } from 'zod';
import { createHandler } from '@/lib/bff/createHandler';

/**
 * TEC balance → the signed-in person's own Pi Network wallet (tec-core-backend #400).
 *
 * GET  — is it open for this account, the balance, and today's limits.
 * POST — { amount, piAccessToken, requestId }. Who is paid is decided by the
 *        SERVICES, never here: wallet-service takes the balance owner from the
 *        verified token, and payment-service pays the Pi account Pi names for
 *        `piAccessToken` only if it is that same person. `requestId` is the
 *        client's id for this one attempt, so a double tap cannot pay twice.
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

async function walletCall(method: 'GET' | 'POST', token: string, requestId: string, body?: unknown) {
  const res = await fetch(`${GATEWAY}/api/wallets/withdraw-to-pi`, {
    method,
    headers: {
      Authorization:  `Bearer ${token}`,
      'x-request-id': requestId,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(' ') : (data?.message ?? data?.error ?? 'The withdrawal could not be completed');
    throw Object.assign(new Error(String(message)), { status: res.status });
  }
  return data?.data ?? data;
}

export const GET = createHandler({
  requireAuth: true,
  handler: async ({ ctx, req }) =>
    walletCall('GET', req.cookies.get('tec_access_token')?.value ?? '', ctx.requestId),
});

export const POST = createHandler({
  requireAuth: true,
  schema: z.object({
    amount:        z.string().regex(/^\d{1,6}(\.\d{1,7})?$/),
    piAccessToken: z.string().min(1).max(4096),
    requestId:     z.string().uuid(),
  }),
  handler: async ({ input, ctx, req }) =>
    walletCall('POST', req.cookies.get('tec_access_token')?.value ?? '', ctx.requestId, input),
});
