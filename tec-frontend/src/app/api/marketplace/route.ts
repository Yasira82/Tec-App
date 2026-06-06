import { NextRequest, NextResponse } from 'next/server';

const ASSET_SERVICE = process.env.API_GATEWAY_URL!;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const params = searchParams.toString();
  try {
    const res = await fetch(
      `${ASSET_SERVICE}/api/assets/marketplace${params ? `?${params}` : ''}`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const endpoint = req.nextUrl.searchParams.get('action') ?? 'list';
  try {
    const body = await req.json();
    const res = await fetch(`${ASSET_SERVICE}/api/assets/marketplace/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
