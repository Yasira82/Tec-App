import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

// ✅ قراءة بس — مش throw على مستوى الـ module
const GATEWAY_URL = process.env.API_GATEWAY_URL;
const SERVICE_SECRET = process.env.SERVICE_SECRET;

function getConfig(): { gatewayUrl: string; serviceSecret: string } {
  if (!GATEWAY_URL) throw new Error('API_GATEWAY_URL is not set');
  if (!SERVICE_SECRET) throw new Error('SERVICE_SECRET is not set');
  return { gatewayUrl: GATEWAY_URL, serviceSecret: SERVICE_SECRET };
}

export interface BffFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown>;
  idempotencyKey?: string;
  accessToken: string;
}

export interface BffFetchResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  tokenExpired?: boolean;
}

export async function bffFetch<T = unknown>(
  path: string,
  options: BffFetchOptions,
): Promise<BffFetchResult<T>> {
  const { gatewayUrl, serviceSecret } = getConfig(); // ✅ throws at request time only
  const { method = 'GET', body, idempotencyKey, accessToken } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
    'x-service-secret': serviceSecret,
    'x-request-id': randomUUID(),
  };

  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  let res: Response;
  try {
    res = await fetch(`${gatewayUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    console.error(`[bff-fetch] Network error → ${path}:`, msg);
    return { ok: false, status: 0, data: null, error: msg };
  }

  if (res.status === 401) {
    let errBody: { error?: { code?: string } } = {};
    try { errBody = await res.json(); } catch { /* ignore */ }
    const code = errBody?.error?.code ?? 'UNAUTHORIZED';
    return { ok: false, status: 401, data: null, error: code, tokenExpired: true };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, status: res.status, data: null, error: 'Invalid JSON from gateway' };
  }

  if (!res.ok) {
    const errJson = json as { error?: { message?: string; code?: string } };
    const msg = errJson?.error?.message ?? errJson?.error?.code ?? `HTTP ${res.status}`;
    console.error(`[bff-fetch] ${method} ${path} → ${res.status}:`, msg);
    return { ok: false, status: res.status, data: null, error: msg };
  }

  return { ok: true, status: res.status, data: json as T, error: null };
}

export async function attemptTokenRefresh(): Promise<string | null> {
  const { gatewayUrl, serviceSecret } = getConfig();
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('tec_refresh_token')?.value;
  if (!refreshToken) return null;

  let res: Response;
  try {
    res = await fetch(`${gatewayUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-secret': serviceSecret,
      },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  let json: { data?: { accessToken?: string } };
  try { json = await res.json(); } catch { return null; }

  return json?.data?.accessToken ?? null;
}

export function buildExpiredResponse(): NextResponse {
  const res = NextResponse.json(
    { success: false, error: { code: 'SESSION_EXPIRED', message: 'Session expired. Please log in again.' } },
    { status: 401 },
  );
  for (const name of ['tec_access_token', 'tec_refresh_token', 'tec_user', 'tec_csrf']) {
    res.cookies.set(name, '', { maxAge: 0, path: '/' });
  }
  return res;
}
