import { NextRequest, NextResponse } from 'next/server';
import { randomUUID }                from 'crypto';
import { isE2eMode }                 from '@/lib/server/e2e-mode';
import { fetchWithTimeout }          from '@/lib/server/fetch-with-timeout';

const GATEWAY = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? '';

function getUserIdFromCookie(req: NextRequest): string | null {
  try {
    const raw = req.cookies.get('tec_user')?.value;
    if (!raw) return null;
    const user = JSON.parse(decodeURIComponent(raw));
    return user?.id ?? user?.uid ?? null;
  } catch { return null; }
}

async function refreshToken(req: NextRequest): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(`${req.nextUrl.origin}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie:         req.headers.get('cookie') ?? '',
        'x-csrf-token': req.cookies.get('tec_csrf')?.value ?? '',
        'Content-Type': 'application/json',
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
    const { payment_id, paymentId, pi_payment_id } = body;

    // ✅ لو payment_id موجود → approve بس (الـ flow القديم)
    if (payment_id) {
      if (isE2eMode()) {
        return NextResponse.json({ success: true, data: { payment_id, status: 'approved' } });
      }
      let res = await fetchWithTimeout(`${GATEWAY}/api/v1/payments/approve`, {
        method: 'POST',
        headers: {
          'Content-Type':    'application/json',
          Authorization:     authHeader,
          'x-internal-key':  process.env.INTERNAL_SECRET ?? '',
          'Idempotency-Key': randomUUID(),
        },
        body: JSON.stringify({ payment_id, pi_payment_id }),
      });
      if (res.status === 401) {
        const t = await refreshToken(req);
        if (t) {
          authHeader = `Bearer ${t}`;
          res = await fetchWithTimeout(`${GATEWAY}/api/v1/payments/approve`, {
            method: 'POST',
            headers: {
              'Content-Type':    'application/json',
              Authorization:     authHeader,
              'x-internal-key':  process.env.INTERNAL_SECRET ?? '',
              'Idempotency-Key': randomUUID(),
            },
            body: JSON.stringify({ payment_id, pi_payment_id }),
          });
        } else return NextResponse.json({ error: 'Session expired' }, { status: 401 });
      }
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(data, { status: res.status });
    }

    // ✅ لو paymentId (Pi ID) بس — create + approve
    const piId = paymentId ?? pi_payment_id;
    if (!piId) {
      return NextResponse.json({ error: 'Missing payment_id or paymentId' }, { status: 400 });
    }

    const userId = getUserIdFromCookie(req);
    const amount = body.amount ?? 1;

    if (isE2eMode()) {
      const fakeId = randomUUID();
      return NextResponse.json({ success: true, data: { payment_id: fakeId, status: 'approved' }, payment_id: fakeId });
    }

    // Step 1: Create
    let createRes = await fetchWithTimeout(`${GATEWAY}/api/v1/payments/create`, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        Authorization:     authHeader,
        'x-internal-key':  process.env.INTERNAL_SECRET ?? '',
        'Idempotency-Key': `create-${piId}`,
      },
      body: JSON.stringify({
        userId,
        amount,
        currency: 'PI',
        payment_method: 'pi',
        metadata: { pi_payment_id: piId },
      }),
    });

    if (createRes.status === 401) {
      const t = await refreshToken(req);
      if (t) {
        authHeader = `Bearer ${t}`;
        createRes = await fetchWithTimeout(`${GATEWAY}/api/v1/payments/create`, {
          method: 'POST',
          headers: {
            'Content-Type':    'application/json',
            Authorization:     authHeader,
            'x-internal-key':  process.env.INTERNAL_SECRET ?? '',
            'Idempotency-Key': `create-${piId}`,
          },
          body: JSON.stringify({
            userId, amount, currency: 'PI', payment_method: 'pi',
            metadata: { pi_payment_id: piId },
          }),
        });
      } else return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    const createData = await createRes.json().catch(() => ({}));
    if (!createRes.ok) return NextResponse.json(createData, { status: createRes.status });

    const dbPaymentId = createData?.data?.payment?.id
      ?? createData?.data?.id
      ?? createData?.payment?.id
      ?? createData?.id;

    if (!dbPaymentId) return NextResponse.json({ error: 'Failed to get payment ID' }, { status: 500 });

    // Step 2: Approve
    const approveRes = await fetchWithTimeout(`${GATEWAY}/api/v1/payments/approve`, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        Authorization:     authHeader,
        'x-internal-key':  process.env.INTERNAL_SECRET ?? '',
        'Idempotency-Key': `approve-${piId}`,
      },
      body: JSON.stringify({ payment_id: dbPaymentId, pi_payment_id: piId }),
    });

    const approveData = await approveRes.json().catch(() => ({}));
    return NextResponse.json(
      { ...approveData, payment_id: dbPaymentId },
      { status: approveRes.status },
    );
  } catch (error) {
    console.error('[approve] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
