import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib-client/pi/pi-auth', () => ({
  getAccessToken: vi.fn(() => 'test-token'),
  getStoredUser:  vi.fn(() => ({ id: 'user-123' })),
  waitForPiSDK:   vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib-client/pi/payment-timeouts', () => ({
  APPROVAL_TIMEOUT_MS:        60000,
  COMPLETION_TIMEOUT_MS:      60000,
  RETRIABLE_STATUS_CODES:     new Set([404, 429]),
  NON_RETRIABLE_STATUS_CODES: new Set([400, 401, 403, 500]),
  MAX_RETRIES:                0,
  RETRY_BASE_DELAY_MS:        0,
}));

vi.mock('@/lib/sdk', () => ({
  default: {
    payment: {
      createPayment:     vi.fn(),
      approvePayment:    vi.fn(),
      completePayment:   vi.fn(),
      getPayment:        vi.fn(),
      resolveIncomplete: vi.fn(),
    },
    auth: {
      loginWithPi:  vi.fn(),
      refreshToken: vi.fn(),
    },
    setAuthToken:   vi.fn(),
    clearAuthToken: vi.fn(),
  },
}));

import { createA2UPayment, createU2APayment } from '@/lib-client/pi/pi-payment';
import sdk from '@/lib/sdk';

const TEST_UUID =
  'test-uuid-1234-5678-abcd-ef0123456789' as `${string}-${string}-${string}-${string}-${string}`;

const makeOkResponse = (body: unknown) => ({
  ok: true, status: 200, json: () => Promise.resolve(body),
});

const setupWindow = (mockCreatePayment = vi.fn()) => {
  (window as any).__TEC_PI_READY = true;
  (window as any).Pi = {
    createPayment: mockCreatePayment,
    authenticate:  vi.fn(),
    init:          vi.fn(),
  };
  return mockCreatePayment;
};

describe('pi-payment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(TEST_UUID);
    process.env.NEXT_PUBLIC_API_GATEWAY_URL = 'https://api.example.com';
  });

  describe('createA2UPayment', () => {
    it('sends Idempotency-Key header', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeOkResponse({ success: true, status: 'pending', amount: 10, memo: 'test' }) as unknown as Response
      );
      await createA2UPayment({ recipientUid: 'uid-123', amount: 10, memo: 'test' });
      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, options] = fetchSpy.mock.calls[0];
      expect(String(url)).toContain('/api/payments/a2u');
      expect((options?.headers as Record<string, string>)['Idempotency-Key']).toBe(TEST_UUID);
    });
  });

  describe('createU2APayment', () => {
    it('returns error when SDK fails', async () => {
      // Pi SDK immediately fires onError — promise should reject
      const mockCreatePayment = vi.fn((_data: unknown, callbacks: Record<string, (e: Error) => void>) => {
        callbacks.onError(new Error('Pi SDK unavailable'));
      });
      setupWindow(mockCreatePayment);
      await expect(createU2APayment(1, 'Test')).rejects.toThrow('Pi SDK error: Pi SDK unavailable');
    });

    it('calls Pi.createPayment after SDK create', async () => {
      const mock = setupWindow();
      const p = createU2APayment(1, 'Test');
      await vi.waitFor(() => expect(mock).toHaveBeenCalled());
      mock.mock.calls[0][1].onCancel();
      const result = await p;
      expect(result.status).toBe('cancelled');
    });

   it('completes full flow', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const u = String(url);
    if (u.includes('payment/create'))
      return { ok: true, status: 200, json: async () => ({ data: { id: 'internal-id' } }) } as Response;
    if (u.includes('payment/approve'))
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    if (u.includes('payment/complete'))
      return { ok: true, status: 200, json: async () => ({ success: true, status: 'completed', amount: 1, memo: 'Test' }) } as Response;
    return { ok: false, status: 404, json: async () => ({}) } as Response;
  });

  const mock = setupWindow();
  const p = createU2APayment(1, 'Test');
  await vi.waitFor(() => expect(mock).toHaveBeenCalled());
  const cb = mock.mock.calls[0][1];
  await cb.onReadyForServerApproval('pi-pay-1');
  await cb.onReadyForServerCompletion('pi-pay-1', 'txid-abc');
  const result = await p;
  expect(result.success).toBe(true);
  expect(result.status).toBe('completed');
}); 

    it('passes transaction_id not txid', async () => {
      // Mock fetch to set internalId so the complete fetch is actually called
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const u = String(url);
        if (u.includes('payment/create'))
          return { ok: true, status: 200, json: async () => ({ data: { id: 'internal-id' } }) } as Response;
        if (u.includes('payment/approve'))
          return { ok: true, status: 200, json: async () => ({}) } as Response;
        if (u.includes('payment/complete'))
          return { ok: true, status: 200, json: async () => ({ success: true, status: 'completed', amount: 1, memo: 'Test' }) } as Response;
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      });

      const mock = setupWindow();
      const p = createU2APayment(1, 'Test');
      await vi.waitFor(() => expect(mock).toHaveBeenCalled());
      const cb = mock.mock.calls[0][1];
      await cb.onReadyForServerApproval('pi-pay-1');
      await cb.onReadyForServerCompletion('pi-pay-1', 'txid-abc');
      await p;

      const completeCall = fetchSpy.mock.calls.find(([url]) => String(url).includes('payment/complete'));
      expect(completeCall).toBeDefined();
      const body = JSON.parse((completeCall![1] as RequestInit).body as string);
      expect(body).toHaveProperty('transaction_id', 'txid-abc');
      expect(body).not.toHaveProperty('txid');
    });

    it('cancelled by user', async () => {
      const mock = setupWindow();
      const p = createU2APayment(1, 'Test');
      await vi.waitFor(() => expect(mock).toHaveBeenCalled());
      mock.mock.calls[0][1].onCancel();
      const result = await p;
      expect(result.success).toBe(false);
      expect(result.status).toBe('cancelled');
    });
  });
});
