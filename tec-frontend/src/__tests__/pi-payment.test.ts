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
      create:            vi.fn(),
      approve:           vi.fn(),
      complete:          vi.fn(),
      getStatus:         vi.fn(),
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
      vi.mocked(sdk.payment.create).mockRejectedValue(new Error('fail'));
      const mock = setupWindow();
      const result = await createU2APayment(1, 'Test');
      expect(result.success).toBe(false);
      expect(result.status).toBe('error');
      expect(mock).not.toHaveBeenCalled();
    });

    it('calls Pi.createPayment after SDK create', async () => {
      vi.mocked(sdk.payment.create).mockResolvedValue({ id: 'internal-id' } as any);
      const mock = setupWindow();
      const p = createU2APayment(1, 'Test');
      await vi.waitFor(() => expect(mock).toHaveBeenCalled());
      mock.mock.calls[0][1].onCancel();
      const result = await p;
      expect(result.status).toBe('cancelled');
    });

    it('completes full flow', async () => {
      vi.mocked(sdk.payment.create).mockResolvedValue({ id: 'internal-id' } as any);
      vi.mocked(sdk.payment.approve).mockResolvedValue({ success: true } as any);
      vi.mocked(sdk.payment.complete).mockResolvedValue({ success: true, status: 'completed', amount: 1, memo: 'Test' } as any);
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
      vi.mocked(sdk.payment.create).mockResolvedValue({ id: 'internal-id' } as any);
      vi.mocked(sdk.payment.approve).mockResolvedValue({ success: true } as any);
      vi.mocked(sdk.payment.complete).mockResolvedValue({ success: true, status: 'completed', amount: 1, memo: 'Test' } as any);
      const mock = setupWindow();
      const p = createU2APayment(1, 'Test');
      await vi.waitFor(() => expect(mock).toHaveBeenCalled());
      const cb = mock.mock.calls[0][1];
      await cb.onReadyForServerApproval('pi-pay-1');
      await cb.onReadyForServerCompletion('pi-pay-1', 'txid-abc');
      await p;
      const call = vi.mocked(sdk.payment.complete).mock.calls[0][0] as any;
      expect(call).toHaveProperty('transaction_id', 'txid-abc');
      expect(call).not.toHaveProperty('txid');
    });

    it('cancelled by user', async () => {
      vi.mocked(sdk.payment.create).mockResolvedValue({ id: 'internal-id' } as any);
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
