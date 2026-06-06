import { NextRequest, NextResponse } from 'next/server';
import { randomUUID }                from 'crypto';
import { isE2eMode }                 from '@/lib/server/e2e-mode';
import { fetchWithTimeout }          from '@/lib/server/fetch-with-timeout';

const GATEWAY = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? '';

const REQUIRED_FIELDS = ['amount', 'currency', 'payment_method'] as const;

function getUserIdFromToken(authHeader: string): string | null {
  try {
    const token   = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload?.sub ?? payload?.id ?? null;
  } catch { return null; }
}

function getUserIdFromCookie(req: NextRequest): string | null {
  try {
    const raw = req.cookies.get('tec_user')?.value;
    if (!raw) return null;
    const user = JSON.parse(decodeURIComponent(raw));
    return user?.id ?? user?.uid ?? null;
  } catch { return null; }
}

// ✅ Fix: الـ refresh token بيتبعت في Authorization header
async function refreshAccessToken(req: NextRequest): Promise<string | null> {
  try {
    const refreshToken = req.cookies.get('tec_refresh_token')?.value;
    if (!refreshToken) return null;

    const res = await fetchWithTimeout(
      `${GATEWAY}/api/v1/auth/refresh`,
      {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${refreshToken}`, // ✅ header مش body
        },
      },
      10000,
    );

    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return data?.tokens?.accessToken ?? data?.token ?? null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const allCookies = req.cookies.getAll().map(c => c.name);
  console.log('[create] cookies:', allCookies.join(', ') || 'NONE');

  let authHeader =
    req.headers.get('authorization') ??
    req.headers.get('Authorization') ??
    (() => {
      const raw = req.cookies.get('tec_access_token')?.value;
      return raw ? `Bearer ${raw}` : null;
    })();

  console.log('[create] authHeader exists:', !!authHeader);

  if (!authHeader?.startsWith('Bearer ')) {
    console.warn('[create] No valid auth header — returning 401');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requestId = req.headers.get('x-request-id') ?? randomUUID();

  try {
    const body = await req.json();
    console.log('[create] body:', JSON.stringify(body));

    const userId =
      getUserIdFromCookie(req) ??
      getUserIdFromToken(authHeader);

    console.log('[create] userId:', userId);

    if (!userId) {
      return NextResponse.json(
        { error: 'Cannot resolve userId from session', requestId },
        { status: 401, headers: { 'X-Request-ID': requestId } },
      );
    }

    const missing = REQUIRED_FIELDS.filter(f => body[f] == null || body[f] === '');
    if (missing.length > 0) {
      return NextResponse.json(
        { error: 'Missing required fields', missing, requestId },
        { status: 400, headers: { 'X-Request-ID': requestId } },
      );
    }

    if (isE2eMode()) {
      return NextResponse.json(
        {
          success: true,
          data: {
            payment_id:     randomUUID(),
            status:         'pending',
            amount:         body.amount,
            currency:       body.currency ?? 'PI',
            payment_method: body.payment_method,
          },
          requestId,
        },
        { status: 201, headers: { 'X-Request-ID': requestId } },
      );
    }

    const idempotencyKey = randomUUID();

    let res = await fetchWithTimeout(`${GATEWAY}/api/v1/payments/create`, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        Authorization:     authHeader,
        'x-internal-key':  process.env.INTERNAL_SECRET ?? '',
        'Idempotency-Key': idempotencyKey,
        'X-Request-ID':    requestId,
      },
      body: JSON.stringify({ ...body, userId }),
    });

    // ✅ لو 401 — جرب refresh وحاول تاني
    if (res.status === 401) {
      console.log('[create] Token expired — attempting refresh...');
      const newToken = await refreshAccessToken(req);

      if (newToken) {
        console.log('[create] Token refreshed — retrying...');
        authHeader = `Bearer ${newToken}`;
        res = await fetchWithTimeout(`${GATEWAY}/api/v1/payments/create`, {
          method:  'POST',
          headers: {
            'Content-Type':    'application/json',
            Authorization:     authHeader,
            'x-internal-key':  process.env.INTERNAL_SECRET ?? '',
            'Idempotency-Key': idempotencyKey,
            'X-Request-ID':    requestId,
          },
          body: JSON.stringify({ ...body, userId }),
        });
      } else {
        console.warn('[create] Token refresh failed');
        return NextResponse.json(
          { error: 'Session expired — please login again' },
          { status: 401, headers: { 'X-Request-ID': requestId } },
        );
      }
    }

    const data = await res.json().catch(() => ({}));
    console.log('[create] gateway response:', res.status, JSON.stringify(data));

    return NextResponse.json(data, {
      status:  res.status,
      headers: { 'X-Request-ID': requestId },
    });
  } catch (err) {
    console.error('[create] error:', err);
    return NextResponse.json(
      { error: 'Service unavailable', requestId },
      { status: 503, headers: { 'X-Request-ID': requestId } },
    );
  }
}
