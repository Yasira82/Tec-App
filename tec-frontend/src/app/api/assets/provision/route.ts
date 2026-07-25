import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify }                 from 'jose';
import { randomUUID }                from 'crypto';
import { checkAssetQuota }           from '@/lib/subscription/plan.server';

const GATEWAY = process.env.API_GATEWAY_URL ?? '';

// 402 payload when a plan's asset cap is hit — shared shape across entry points.
const quotaResponse = (plan: string, limit: number, owned: number) =>
  NextResponse.json(
    {
      error:        `Your ${plan} plan allows up to ${limit} assets. Upgrade to Pro for unlimited assets.`,
      code:         'UPGRADE_REQUIRED',
      requiredPlan: 'PRO',
      limit,
      owned,
    },
    { status: 402 },
  );

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

  // ✅ sanitize slug
  const rawSlug = body.slug.toLowerCase().trim();
  const slug    = rawSlug
    .replace(/[^a-z0-9\-_.]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (slug.length < 3) {
    return NextResponse.json({ error: 'slug too short (min 3 chars)' }, { status: 400 });
  }

  // ── Subscription entitlement: FREE plan asset cap (real "Unlimited assets") ─
  const quota = await checkAssetQuota(token, userId);
  if (!quota.allowed) return quotaResponse(quota.plan, quota.limit, quota.owned);

  const category = body.category ?? 'DOMAIN';
  const metadata = body.metadata ?? {};

  if (category === 'DOMAIN' && !metadata.extension) {
    metadata.extension = '.pi';
  }

  const res = await fetch(`${GATEWAY}/api/assets/provision`, {
    method:  'POST',
    headers: {
      'Content-Type':   'application/json',
      Authorization:    `Bearer ${token}`,
      ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
    },
    body: JSON.stringify({
      transactionId: randomUUID(),
      userId,
      category,
      slug,
      metadata: {
        ...metadata,
        piPaymentId: body.payment_id,
      },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('[Provision] failed:', res.status, JSON.stringify(data));
  }

  return NextResponse.json(data, { status: res.status });
}
