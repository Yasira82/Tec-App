import { NextRequest, NextResponse } from 'next/server';
import { randomUUID }                from 'crypto';
import { isE2eMode }                 from '@/lib/server/e2e-mode';
import { fetchWithTimeout }          from '@/lib/server/fetch-with-timeout';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

async function refreshToken(req: NextRequest): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(`${req.nextUrl.origin}/api/auth/refresh`, {
      method:  'POST',
      headers: {
        'Cookie':        req.headers.get('cookie') ?? '',
        'x-csrf-token':  req.cookies.get('tec_csrf')?.value ?? '',
        'Content-Type':  'application/json',
      },
    }, 10000);
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return data.token ?? null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  try {
    let authHeader =
      req.headers.get('Authorization') ??
      req.headers.get('authorization') ??
      (() => {
        const raw = req.cookies.get('tec_access_token')?.value;
        return raw ? `Bearer ${raw}` : null;
      })();

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { payment_id, pi_payment_id } = body;

    if (!payment_id) {
      return NextResponse.json({ error: 'Missing payment_id' }, { status: 400 });
    }

    if (isE2eMode()) {
      return NextResponse.json(
        { success: true, data: { payment_id, pi_payment_id, status: 'approved' } },
        { status: 200 },
      );
    }

    const idempotencyKey = randomUUID();

    let res = await fetchWithTimeout(`${GATEWAY}/api/v1/payments/approve`, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        Authorization:     authHeader,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ payment_id, pi_payment_id }),
    });

    // ✅ Token expired → refresh وحاول تاني
    if (res.status === 401) {
      console.log('[approve] TOKEN_EXPIRED — refreshing...');
      const newToken = await refreshToken(req);
      if (newToken) {
        authHeader = `Bearer ${newToken}`;
        res = await fetchWithTimeout(`${GATEWAY}/api/v1/payments/approve`, {
          method: 'POST',
          headers: {
            'Content-Type':    'application/json',
            Authorization:     authHeader,
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({ payment_id, pi_payment_id }),
        });
      } else {
        return NextResponse.json({ error: 'Session expired' }, { status: 401 });
      }
    }

    const data = await res.json().catch(() => ({}));
    console.log('[approve] gateway response:', res.status, JSON.stringify(data));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[approve] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
