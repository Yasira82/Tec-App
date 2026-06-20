import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { fetchWithTimeout } from './fetch-with-timeout';

/**
 * Single source for authenticated POSTs to the API Gateway from payment BFF
 * routes (create / approve / complete / resolve-incomplete / cancel).
 *
 * Why this exists (ADR-009 follow-up): the resolve/cancel routes used to call
 * the gateway with the raw access token and NO refresh. When the token expired
 * the gateway returned TOKEN_EXPIRED, the incomplete-payment resolver failed,
 * and the pending payment stayed stuck — blocking all new payments. This helper
 * makes every payment mutation:
 *   1. read the access token from the cookie (preferred) or Authorization header
 *   2. attach x-internal-key (the only internal-auth header the gateway accepts)
 *   3. refresh the access token ONCE on 401 and retry — so an expired session
 *      never leaves a payment in a stuck state.
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export function getAccessToken(req: NextRequest): string | null {
  const cookie = req.cookies.get('tec_access_token')?.value;
  if (cookie) return cookie;
  const h = req.headers.get('authorization') ?? req.headers.get('Authorization');
  return h?.startsWith('Bearer ') ? h.slice(7) : null;
}

async function refreshAccessToken(req: NextRequest): Promise<string | null> {
  const refreshToken = req.cookies.get('tec_refresh_token')?.value;
  if (!refreshToken) return null;
  try {
    const res = await fetchWithTimeout(
      `${GATEWAY}/api/v1/auth/refresh`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${refreshToken}` },
      },
      10_000,
    );
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return data?.tokens?.accessToken ?? data?.token ?? null;
  } catch {
    return null;
  }
}

export interface GatewayResult {
  ok:     boolean;
  status: number;
  data:   unknown;
}

/**
 * POST to the gateway with the user's token + internal key, refreshing the
 * access token once on 401 (expired) and retrying.
 *
 * @param path gateway path including any query string, e.g.
 *             '/api/payment/resolve-incomplete?pi_payment_id=abc'
 */
export async function gatewayPost(
  req:  NextRequest,
  path: string,
  body: Record<string, unknown>,
): Promise<GatewayResult> {
  const token = getAccessToken(req);
  if (!token) return { ok: false, status: 401, data: { error: 'Unauthorized' } };

  const call = (t: string) =>
    fetchWithTimeout(
      `${GATEWAY}${path}`,
      {
        method:  'POST',
        headers: {
          'Content-Type':    'application/json',
          Authorization:     `Bearer ${t}`,
          ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
          'Idempotency-Key': randomUUID(),
        },
        body: JSON.stringify(body),
      },
      15_000,
    );

  try {
    let res = await call(token);

    // Expired session → refresh once and retry so the payment never gets stuck.
    if (res.status === 401) {
      const fresh = await refreshAccessToken(req);
      if (!fresh) {
        return { ok: false, status: 401, data: { error: 'Session expired — please log in again', code: 'SESSION_EXPIRED' } };
      }
      res = await call(fresh);
    }

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 503, data: { error: 'Service unavailable' } };
  }
}
