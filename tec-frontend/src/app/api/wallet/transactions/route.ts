import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/server/fetch-with-timeout';

const GATEWAY = process.env.API_GATEWAY_URL ?? process.env.API_GATEWAY_URL!;

function getWalletIdFromCookie(_req: NextRequest): string | null {
  return null; // walletId بييجي من الـ query param
}

export async function GET(req: NextRequest) {
  const token    = req.cookies.get('tec_access_token')?.value;
  const walletId = req.nextUrl.searchParams.get('walletId');
  const page     = req.nextUrl.searchParams.get('page')  ?? '1';
  const limit    = req.nextUrl.searchParams.get('limit') ?? '20';

  if (!token)    return NextResponse.json({ error: 'Unauthorized' },     { status: 401 });
  if (!walletId) return NextResponse.json({ error: 'walletId required' },{ status: 400 });

  try {
    const params = new URLSearchParams({ page, limit });
    const res    = await fetchWithTimeout(
      `${GATEWAY}/api/wallets/${encodeURIComponent(walletId)}/transactions?${params}`,
      {
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      },
    );

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
