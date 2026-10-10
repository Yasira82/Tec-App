import { NextRequest, NextResponse } from 'next/server';

/**
 * What is owed to sellers, and what the Hub wallet holds — admin, read-only
 * (tec-core-backend #409). Three services own the three numbers; each is asked with
 * the session token only, and a part that cannot be read comes back null rather than
 * failing the page — the page then says which part is missing.
 */
const GATEWAY = process.env.API_GATEWAY_URL ?? '';

const read = async (path: string, token: string): Promise<{ status: number; data: unknown }> => {
  try {
    const res = await fetch(`${GATEWAY}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, data: res.ok ? (body?.data ?? body) : null };
  } catch {
    return { status: 502, data: null };
  }
};

export async function GET(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [wallet, payouts, hub] = await Promise.all([
    read('/api/wallets/admin/liabilities', token),
    read('/api/commerce/payouts/summary', token),
    read('/api/payment/admin/app-wallet', token),
  ]);
  if ([wallet, payouts, hub].some((r) => r.status === 401 || r.status === 403)) {
    return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  }
  return NextResponse.json({ wallet: wallet.data, payouts: payouts.data, hub: hub.data });
}
