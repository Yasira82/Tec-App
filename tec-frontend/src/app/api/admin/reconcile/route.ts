import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

const PAYMENT_SERVICE = process.env.PAYMENT_SERVICE_URL!;
const INTERNAL_KEY = process.env.INTERNAL_SECRET!;

function isAuthorized(req: NextRequest): boolean {
  // ✅ Inter-service via x-internal-key
  const internalKey = req.headers.get('x-internal-key');
  if (
    INTERNAL_KEY &&
    typeof internalKey === 'string' &&
    internalKey.length === INTERNAL_KEY.length &&
    timingSafeEqual(Buffer.from(internalKey), Buffer.from(INTERNAL_KEY))
  ) {
    return true;
  }
  // ✅ Admin via Bearer token (validated by Gateway)
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return true;

  return false;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch(`${PAYMENT_SERVICE}/payments/reconcile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': INTERNAL_KEY,
      },
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: 'Reconcile failed', message: String(err) }, { status: 503 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
