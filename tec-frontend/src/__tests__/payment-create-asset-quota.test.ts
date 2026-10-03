/**
 * A NEW asset paid through the Hub's modal (Mode 1) meets the plan's asset cap
 * before any π moves. The cap lived only on /api/assets(/provision), which an
 * app-minted NFT never passes: a FREE owner with 65 assets minted a 66th from
 * Assets (2026-10-03).
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockQuota        = vi.hoisted(() => vi.fn());
const mockFetchTimeout = vi.hoisted(() => vi.fn());
vi.mock('@/lib/subscription/plan.server',   () => ({ checkAssetQuota: mockQuota }));
vi.mock('@/lib/server/e2e-mode',            () => ({ isE2eMode: () => false }));
vi.mock('@/lib/server/fetch-with-timeout',  () => ({ fetchWithTimeout: mockFetchTimeout }));

const req = (product_id: string) => {
  const r = new NextRequest('https://hub.tecosystem.app/api/payment/create', {
    method:  'POST',
    headers: { authorization: 'Bearer tok', 'content-type': 'application/json' },
    body:    JSON.stringify({ amount: 1, currency: 'PI', payment_method: 'pi', metadata: { app_source: 'assets', product_id } }),
  });
  r.cookies.set('tec_user', encodeURIComponent(JSON.stringify({ id: 'u1' })));
  return r;
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.API_GATEWAY_URL = 'https://gw.internal';
  mockFetchTimeout.mockResolvedValue(new Response(JSON.stringify({ success: true, data: { payment: { id: 'p1' } } }), { status: 201 }));
});

describe('Hub /api/payment/create — the asset cap on a new asset', () => {
  it('a FREE user at the cap is refused with 402 UPGRADE_REQUIRED, and payment-service is never called', async () => {
    mockQuota.mockResolvedValue({ allowed: false, plan: 'FREE', limit: 5, owned: 65 });
    const { POST } = await import('@/app/api/payment/create/route');
    const res = await POST(req('nft:abc'));
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ code: 'UPGRADE_REQUIRED', limit: 5, owned: 65 });
    expect(mockQuota).toHaveBeenCalledWith('tok', 'u1');
    expect(mockFetchTimeout).not.toHaveBeenCalled();
  });

  it('under the cap, the payment is created', async () => {
    mockQuota.mockResolvedValue({ allowed: true });
    const { POST } = await import('@/app/api/payment/create/route');
    expect((await POST(req('nft:abc'))).status).toBe(201);
  });

  it('a payment that creates no asset is not checked', async () => {
    const { POST } = await import('@/app/api/payment/create/route');
    expect((await POST(req('pro_monthly'))).status).toBe(201);
    expect((await POST(req('domain-nft:00000000-0000-4000-8000-000000000000'))).status).toBe(201);
    expect(mockQuota).not.toHaveBeenCalled();
  });
});

describe('Hub /api/payment/create — a header with no real token', () => {
  it('"Bearer null" falls back to the session cookie', async () => {
    const r = new NextRequest('https://hub.tecosystem.app/api/payment/create', {
      method:  'POST',
      headers: { authorization: 'Bearer null', 'content-type': 'application/json' },
      body:    JSON.stringify({ amount: 10, currency: 'PI', payment_method: 'pi', metadata: { type: 'subscription', plan: 'PRO' } }),
    });
    r.cookies.set('tec_user', encodeURIComponent(JSON.stringify({ id: 'u1' })));
    r.cookies.set('tec_access_token', 'cookie-tok');
    const { POST } = await import('@/app/api/payment/create/route');
    expect((await POST(r)).status).toBe(201);
    const init = mockFetchTimeout.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization ?? (init.headers as Record<string, string>).authorization).toBe('Bearer cookie-tok');
  });
});
