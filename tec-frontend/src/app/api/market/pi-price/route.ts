import { NextResponse } from 'next/server';

const GATEWAY = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

// ✅ Simple in-memory rate limiter
const rateMap = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT = 60; // requests
const WINDOW_MS = 60000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);

  if (!entry || now > entry.reset) {
    rateMap.set(ip, { count: 1, reset: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) return false;

  entry.count++;
  return true;
}

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  try {
    const res = await fetch('https://www.okx.com/api/v5/market/ticker?instId=PI-USDT', {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) throw new Error(`OKX API error: ${res.status}`);

    const json = await res.json().catch(() => ({}));
    const data = json?.data?.[0];
    if (!data) throw new Error('No data from OKX');

    const price = parseFloat(data.last);
    const open24h = parseFloat(data.open24h);
    const change24h = ((price - open24h) / open24h) * 100;

    return NextResponse.json(
      {
        price: price,
        change24h: parseFloat(change24h.toFixed(2)),
        vol24h: parseFloat(data.vol24h),
        high24h: parseFloat(data.high24h),
        low24h: parseFloat(data.low24h),
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  } catch {
    return NextResponse.json({ error: 'Price unavailable' }, { status: 503 });
  }
}
