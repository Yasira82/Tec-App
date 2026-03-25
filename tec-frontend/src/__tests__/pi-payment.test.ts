import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────
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
      create:    vi.fn(),
      approve:   vi.fn(),
      complete:  vi.fn(),
      getStatus: vi.fn(),
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

// ── Helpers ───────────────────────────────────────────────────
const TEST_UUID =
  'test-uuid-1234-5678-abcd-ef0123456789' as `${string}-${string}-${string}-${string}-${string}`;

const makeOkResponse = (body: unknown) => ({
  ok:     true,
  status: 200,
  json:   () => Promise.resolve(body),
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

// ── Tests ─────────────────────────────────────────────────────
describe('pi-payment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(TEST_UUID);
    process.env.NEXT_PUBLIC_API_GATEWAY_URL = 'https://api.example.com';
  });

  // ═══════════════════════════════════════════════════════════
  // A2U — uses fetch directly
  // ═══════════════════════════════════════════════════════════
  describe('createA2UPayment', () => {
    it('sends Idempotency-Key header in /payments/a2u request', async () => {
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

  // ═══════════════════════════════════════════════════════════
  // U2A — uses SDK internally
  // ═══════════════════════════════════════════════════════════
  describe('createU2APayment', () => {

    it('returns error when SDK payment creation fails', async () => {
      vi.mocked(sdk.payment.create).mockRejectedValue(new Error('Server error'));
      const mockCreatePayment = setupWindow();

      const result = await createU2APayment(1, 'Test');

      expect(result.success).toBe(false);
      expect(result.status).toBe('error');
      expect(result.message).toContain('Failed to create payment record');
      expect(mockCreatePayment).not.toHaveBeenCalled();
    });

    it('calls Pi.createPayment after successful SDK record creation', async () => {
      vi.mocked(sdk.payment.create).mockResolvedValue({ id: 'internal-id' } as any);
      const mockCreatePayment = setupWindow();

      const paymentPromise = createU2APayment(1, 'Test');
      await vi.waitFor(() => expect(mockCreatePayment).toHaveBeenCalled());

      // cancel cleanly
      mockCreatePayment.mock.calls[0][1].onCancel();
      const result = await paymentPromise;

      expect(mockCreatePayment).toHaveBeenCalledOnce();
      expect(result.status).toBe('cancelled');
    });

    it('completes full flow: create → approve → complete', async () => {
      vi.mocked(sdk.payment.create).mockResolvedValue({ id: 'internal-id' } as any);
      vi.mocked(sdk.payment.approve).mockResolvedValue({ success: true } as any);
      vi.mocked(sdk.payment.complete).mockResolvedValue({
        success: true, status: 'completed', amount: 1, memo: 'Test',
      } as any);

      const mockCreatePayment = setupWindow();
      const paymentPromise    = createU2APayment(1, 'Test');

      await vi.waitFor(() => expect(mockCreatePayment).toHaveBeenCalled());
      const callbacks = mockCreatePayment.mock.calls[0][1];

      await callbacks.onReadyForServerApproval('pi-pay-1');
      await callbacks.onReadyForServerCompletion('pi-pay-1', 'txid-abc12345');
      const result = await paymentPromise;

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(sdk.payment.approve).toHaveBeenCalledWith({
        payment_id:    'internal-id',
        pi_payment_id: 'pi-pay-1',
      });
      expect(sdk.payment.complete).toHaveBeenCalledWith({
        payment_id:     'internal-id',
        transaction_id: 'txid-abc12345',
      });
    });

    it('passes transaction_id (not txid) to SDK complete', async () => {
      vi.mocked(sdk.payment.create).mockResolvedValue({ id: 'internal-id' } as any);
      vi.mocked(sdk.payment.approve).mockResolvedValue({ success: true } as any);
      vi.mocked(sdk.payment.complete).mockResolvedValue({ success: true, status: 'completed', amount: 1, memo: 'Test' } as any);

      const mockCreatePayment = setupWindow();
      const paymentPromise    = createU2APayment(1, 'Test');

      await vi.waitFor(() => expect(mockCreatePayment).toHaveBeenCalled());
      const callbacks = mockCreatePayment.mock.calls[0][1];

      await callbacks.onReadyForServerApproval('pi-pay-1');
      await callbacks.onReadyForServerCompletion('pi-pay-1', 'txid-abc12345');
      await paymentPromise;

      const completeCall = vi.mocked(sdk.payment.complete).mock.calls[0][0] as any;
      expect(completeCall).toHaveProperty('transaction_id', 'txid-abc12345');
      expect(completeCall).not.toHaveProperty('txid');
      expect(completeCall).toHaveProperty('payment_id', 'internal-id');
    });

    it('resolves with cancelled when user cancels', async () => {
      vi.mocked(sdk.payment.create).mockResolvedValue({ id: 'internal-id' } as any);
      const mockCreatePayment = setupWindow();

      const paymentPromise = createU2APayment(1, 'Test');
      await vi.waitFor(() => expect(mockCreatePayment).toHaveBeenCalled());

      mockCreatePayment.mock.calls[0][1].onCancel();
      const result = await paymentPromise;

      expect(result.success).toBe(false);
      expect(result.status).toBe('cancelled');
    });

    it('full E2E: no SDK errors means successful completion', async () => {
      vi.mocked(sdk.payment.create).mockResolvedValue({ id: 'e2e-id' } as any);
      vi.mocked(sdk.payment.approve).mockResolvedValue({ success: true } as any);
      vi.mocked(sdk.payment.complete).mockResolvedValue({
        success: true, status: 'completed', amount: 1, memo: 'E2E Test',
      } as any);

      const mockCreatePayment = setupWindow();
      const paymentPromise    = createU2APayment(1, 'E2E Test');

      await vi.waitFor(() => expect(mockCreatePayment).toHaveBeenCalled());
      const callbacks = mockCreatePayment.mock.calls[0][1];

      await callbacks.onReadyForServerApproval('pi-e2e');
      await callbacks.onReadyForServerCompletion('pi-e2e', 'txid-e2e12345');
      const result = await paymentPromise;

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(sdk.payment.create).toHaveBeenCalledOnce();
      expect(sdk.payment.approve).toHaveBeenCalledOnce();
      expect(sdk.payment.complete).toHaveBeenCalledOnce();
    });
  });
});
