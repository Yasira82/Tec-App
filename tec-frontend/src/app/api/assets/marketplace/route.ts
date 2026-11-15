import { NextRequest, NextResponse } from 'next/server';
import { gatewayFetch } from '@/lib/gateway-fetch';

const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const query = searchParams.toString();

  try {
    const res = await gatewayFetch(
      `${GATEWAY}/api/assets/marketplace${query ? `?${query}` : ''}`,
      { cache: 'no-store' },
    );

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch marketplace' },
      { status: 500 },
    );
  }
}
