import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify }                 from 'jose';

const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ✅ استخرج buyerId من JWT
  let buyerId: string | null = null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET),
      { algorithms: ['HS256'] },
    );
    buyerId = payload.sub ?? null;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (!buyerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  if (!body.listing_id || !body.payment_id) {
    return NextResponse.json({ error: 'listing_id and payment_id required' }, { status: 400 });
  }

  const res = await fetch(
    `${GATEWAY}/api/assets/marketplace/${body.listing_id}/buy`,
    {
      method:  'POST',
      headers: {
        'Content-Type':   'application/json',
        Authorization:    `Bearer ${token}`,
        ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
      },
      body: JSON.stringify({
        buyerId,
        paymentId: body.payment_id,
      }),
    },
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
