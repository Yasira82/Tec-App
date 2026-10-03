// The Hub's Mode-1 handoff read the product ONLY from `product_id`. tec-template-base's
// redirectToHubPayment sends it as `item` — and so do the 17 apps cloned from it
// (Estate, Zone, Vip, Titan, System, …; only Life, Analytics and Connection send
// `product_id`). Their payments reached payment-service with product_id '' and
// commerce's SubscriptionConsumer, which derives the plan from `<slug>_pro_monthly`,
// ignored them: a Pro bought from the Hub was paid for and never activated.
//
// The Hub owns the Mode-1 contract, so it accepts both names. `product_id` wins when
// both are present (it is the documented name); `item` is the alias the fleet sends.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useExternalPayment } from '@/lib-client/hooks/useExternalPayment';
import { piSession } from '@/lib-client/pi/pi-session';

const metadataSentToCreate = async (url: string): Promise<Record<string, unknown>> => {
  window.history.replaceState({}, '', url);
  vi.spyOn(piSession, 'ensurePaymentsReady').mockResolvedValue(true);
  const fetchMock = vi.fn(async () =>
    ({ ok: true, json: async () => ({ data: { payment: { id: 'p1' } } }) }) as unknown as Response);
  vi.stubGlobal('fetch', fetchMock);

  renderHook(() => useExternalPayment({ isLoading: false, piReady: true, user: { id: 'u1' }, onError: () => {} }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());

  const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
  vi.unstubAllGlobals();
  return body.metadata;
};
const productSentToCreate = async (url: string) => (await metadataSentToCreate(url)).product_id;

describe('Mode 1 — the product reaches the payment whichever name the app used', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('reads `item` — what tec-template-base and 17 apps send', async () => {
    expect(await productSentToCreate('/hub?pay=1&amount=15&source=estate&item=estate_pro_monthly'))
      .toBe('estate_pro_monthly');
  });

  it('reads `product_id` — the documented name', async () => {
    expect(await productSentToCreate('/hub?pay=1&amount=10&source=analytics&product_id=analytics_pro_monthly'))
      .toBe('analytics_pro_monthly');
  });

  it('prefers `product_id` when an app sends both (Life sends both)', async () => {
    expect(await productSentToCreate('/hub?pay=1&amount=5&source=life&product_id=life_pro_monthly&item=legacy'))
      .toBe('life_pro_monthly');
  });
});

// Ecommerce holds the last unit BEFORE sending the buyer here; the hold's id has
// to reach the payment's metadata, or the paid hold is never settled.
describe('Mode 1 — the held order rides into the payment', () => {
  beforeEach(() => vi.restoreAllMocks());
  const ORDER = '11111111-2222-4333-8444-555555555555';

  it('carries order_id when the app sent one', async () => {
    const m = await metadataSentToCreate(`/hub?pay=1&amount=12&source=ecommerce&product_id=p1&order_id=${ORDER}`);
    expect(m.order_id).toBe(ORDER);
  });

  it('drops an order_id that is not a UUID', async () => {
    const m = await metadataSentToCreate('/hub?pay=1&amount=12&source=ecommerce&product_id=p1&order_id=..%2Fx');
    expect(m).not.toHaveProperty('order_id');
  });

  it('sends no order_id when the app sent none (every Pro purchase)', async () => {
    const m = await metadataSentToCreate('/hub?pay=1&amount=15&source=estate&item=estate_pro_monthly');
    expect(m).not.toHaveProperty('order_id');
  });
});
