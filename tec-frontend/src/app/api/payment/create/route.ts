import { NextRequest, NextResponse } from 'next/server';
import { randomUUID }                from 'crypto';
import { isE2eMode }                 from '@/lib/server/e2e-mode';
import { fetchWithTimeout }          from '@/lib/server/fetch-with-timeout';
import { networkMetadata }           from '@/lib/pi-network';

const GATEWAY = process.env.API_GATEWAY_URL ?? '';

const REQUIRED_FIELDS = ['amount', 'currency', 'payment_method'] as const;

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
  let authHeader =
    req.headers.get('authorization') ??
    req.headers.get('Authorization') ??
    (() => {
      const raw = req.cookies.get('tec_access_token')?.value;
      return raw ? `Bearer ${raw}` : null;
    })();

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requestId = req.headers.get('x-request-id') ?? randomUUID();

  try {
    const body = await req.json();

    const userId = getUserIdFromCookie(req);

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

    /**
     * Which Pi network this payment settles on.
     *
     * This is THE Hub payment route — `pi-payment.ts`, `useExternalPayment`
     * (Mode 1, every other app's Hub modal), mint and checkout all post here.
     * `/api/bff/payment/create` is the ADR-009-shaped sibling and no production
     * code calls it, so a guard placed only there guards nothing.
     *
     * Derived from THIS route's own Host header: the Hub's Mainnet host and its
     * paired Testnet host are one deployment, and `NEXT_PUBLIC_*` is inlined at
     * build time, so an env var cannot tell them apart. Present only when true,
     * so a Mainnet payment's payload is byte-identical to what it always was.
     *
     * A client-sent `testnet` is REMOVED, not overwritten. On the Mainnet host
     * the derived object is EMPTY, so spreading it over the caller's bag
     * overwrites nothing and the claim survives — and payment-service reads
     * exactly this field to choose which Pi API key approves the payment
     * (`piTargetOf`), while commerce reads it to decide whether to grant PRO.
     * A caller that could set it could pay with free Test-Pi and have a
     * consumer grant something real.
     */
    const { metadata: clientMetadata, ...restOfBody } = body as Record<string, unknown>;
    const { testnet: _clientTestnet, ...callerMetadata } =
      (clientMetadata ?? {}) as Record<string, unknown>;

    // Built ONCE. The 401-refresh path below re-sends, and two literals is how
    // a retry quietly stops carrying what the first attempt carried.
    const upstreamBody = JSON.stringify({
      ...restOfBody,
      userId,
      metadata: { ...callerMetadata, ...networkMetadata(req.headers.get('host')) },
    });

    let res = await fetchWithTimeout(`${GATEWAY}/api/v1/payments/create`, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        Authorization:     authHeader,
        ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
        'Idempotency-Key': idempotencyKey,
        'X-Request-ID':    requestId,
      },
      body: upstreamBody,
    });

    // ✅ لو 401 — جرب refresh وحاول تاني
    if (res.status === 401) {
      const newToken = await refreshAccessToken(req);

      if (newToken) {
        authHeader = `Bearer ${newToken}`;
        res = await fetchWithTimeout(`${GATEWAY}/api/v1/payments/create`, {
          method:  'POST',
          headers: {
            'Content-Type':    'application/json',
            Authorization:     authHeader,
            ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
            'Idempotency-Key': idempotencyKey,
            'X-Request-ID':    requestId,
          },
          body: upstreamBody,
        });
      } else {
        return NextResponse.json(
          { error: 'Session expired — please login again' },
          { status: 401, headers: { 'X-Request-ID': requestId } },
        );
      }
    }

    const data = await res.json().catch(() => ({}));

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
