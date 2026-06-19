import { NextRequest, NextResponse } from 'next/server';

const GATEWAY   = process.env.API_GATEWAY_URL ?? '';
const WINDOW_MS = 24 * 60 * 60 * 1000;

interface RawPayment {
  status:    string;
  createdAt: string;
  amount:    number | string;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!GATEWAY) return NextResponse.json({ error: 'Gateway not configured' }, { status: 503 });

  try {
    const res = await fetch(`${GATEWAY}/api/payment/history?limit=100&sort=desc`, {
      headers: {
        Authorization:    `Bearer ${token}`,
        ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
      },
      cache:  'no-store',
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
    }

    const data = await res.json();
    const all: RawPayment[] = data?.data?.payments ?? data?.payments ?? data?.data ?? [];

    const cutoff  = Date.now() - WINDOW_MS;
    const last24h = all.filter(p => new Date(p.createdAt).getTime() >= cutoff);

    const total     = last24h.length;
    const completed = last24h.filter(p => p.status === 'completed').length;
    const failed    = last24h.filter(p => ['failed', 'error'].includes(p.status)).length;
    const cancelled = last24h.filter(p => p.status === 'cancelled').length;
    const volume    = last24h
      .filter(p => p.status === 'completed')
      .reduce((s, p) => s + Number(p.amount), 0);

    const successRate = total > 0 ? Math.round((completed / total) * 100) : null;

    return NextResponse.json({
      window:      '24h',
      total,
      completed,
      failed,
      cancelled,
      pending:     total - completed - failed - cancelled,
      successRate,
      volume:      volume.toFixed(4),
      healthy:     successRate === null || successRate >= 80,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Metrics unavailable', detail: (err as Error).message },
      { status: 502 },
    );
  }
}
