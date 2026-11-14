import { NextRequest, NextResponse } from 'next/server';
import { gatewayFetch } from '@/lib/gateway-fetch';

const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get('tec_access_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await gatewayFetch(`${GATEWAY}/api/notification/read-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
