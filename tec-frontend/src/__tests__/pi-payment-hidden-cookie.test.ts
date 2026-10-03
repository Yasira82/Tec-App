/**
 * Pi Browser hides the HttpOnly tec_user / tec_access_token cookies from page JS
 * (C-123 §3). createU2APayment created its payment record only when it could read a
 * user id from them, so in Pi Browser it skipped the step and stopped at "Payment
 * setup failed" before Pi opened — the Hub's "Upgrade to Pro" did exactly that
 * (owner, 2026-10-03). It also sent `Authorization: Bearer null`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib-client/pi/pi-auth', () => ({
  getAccessToken: vi.fn(() => null),
  getStoredUser:  vi.fn(() => null),          // the cookie page JS cannot see
  waitForPiSDK:   vi.fn(() => Promise.resolve()),
}));
const mockSessionToken = vi.hoisted(() => vi.fn<() => string | null>(() => null));
vi.mock('@/lib-client/pi/session-source', () => ({ sessionToken: mockSessionToken }));
vi.mock('@/lib-client/pi/pi-session', () => ({
  piSession: {
    isAuthenticated: true, hasScope: true,
    ensureAuth: vi.fn(() => Promise.resolve(true)),
    ensurePaymentsReady: vi.fn(() => Promise.resolve(true)),
    acquirePaymentLock: vi.fn(() => Promise.resolve(true)),
    releasePaymentLock: vi.fn(), reset: vi.fn(), reInit: vi.fn(), lastError: null,
  },
}));
vi.mock('@/lib/request-id', () => ({ buildHeaders: vi.fn().mockReturnValue({}) }));

import { createU2APayment } from '@/lib-client/pi/pi-payment';

describe('createU2APayment when page JS cannot read the session cookies', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let piCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { payment: { id: 'pay-1' } } }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    piCreate = vi.fn();
    (window as any).Pi = { createPayment: piCreate, init: vi.fn() };
    mockSessionToken.mockReturnValue(null);
  });

  it('still creates the payment record — and Pi opens', async () => {
    void createU2APayment(10, 'TEC Pro subscription — 1 month', { type: 'subscription', plan: 'PRO' }).catch(() => {});
    await vi.waitFor(() => expect(piCreate).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/payment/create');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ amount: 10, metadata: { type: 'subscription', plan: 'PRO' } });
    expect(body.userId).toBeUndefined();                 // the server resolves the user
  });

  it('sends no "Bearer null" — no token, no Authorization header', async () => {
    void createU2APayment(10, 'm', {}).catch(() => {});
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const headers = (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('sends the in-memory session token when there is one', async () => {
    mockSessionToken.mockReturnValue('mem-token');
    void createU2APayment(10, 'm', {}).catch(() => {});
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const headers = (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer mem-token');
  });
});
