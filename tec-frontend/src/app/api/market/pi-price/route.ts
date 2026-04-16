import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res  = await fetch('https://www.okx.com/api/v5/market/ticker?instId=PI-USDT', {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) throw new Error(`OKX API error: ${res.status}`);

    const json = await res.json();
    const data = json?.data?.[0];

    if (!data) throw new Error('No data from OKX');

    const price     = parseFloat(data.last);
    const open24h   = parseFloat(data.open24h);
    const change24h = ((price - open24h) / open24h) * 100;
    const vol24h    = parseFloat(data.vol24h);

    return NextResponse.json({
      price:     price,
      change24h: parseFloat(change24h.toFixed(2)),
      vol24h:    parseFloat(vol24h.toFixed(2)),
      high24h:   parseFloat(data.high24h),
      low24h:    parseFloat(data.low24h),
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: 'Price unavailable' },
      { status: 503 },
    );
  }
}
