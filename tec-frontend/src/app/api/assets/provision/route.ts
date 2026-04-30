import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify }                 from 'jose';

const GATEWAY = process.env.API_GATEWAY_URL
  ?? process.env.NEXT_PUBLIC_API_GATEWAY_URL;

export async function POST(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let userId: string | null = null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET),
      { algorithms: ['HS256'] },
    );
    userId = payload.sub ?? null;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  if (!body.slug || !body.payment_id) {
    return NextResponse.json({ error: 'slug and payment_id required' }, { status: 400 });
  }

  const slug = body.slug.toLowerCase().trim();

  const res = await fetch(`${GATEWAY}/api/assets/provision`, {
    method:  'POST',
    headers: {
      'Content-Type':   'application/json',
      Authorization:    `Bearer ${token}`,
      'x-internal-key': process.env.INTERNAL_SECRET ?? '',
    },
    body: JSON.stringify({
      transactionId: body.payment_id,
      userId,
      category:      'DOMAIN',
      slug,
      metadata: {
        extension: '.pi',
        addedBy:   userId,
      },
    }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
