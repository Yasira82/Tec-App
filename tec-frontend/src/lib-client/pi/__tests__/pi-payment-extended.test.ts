import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/sdk', () => ({
  default: {
    clearAuthToken: vi.fn(),
    payment: {
      resolveIncomplete: vi.fn(),
      getPayment:        vi.fn().mockResolvedValue({
        success:   true,
        paymentId: 'pay-123',
        status:    'completed',
        amount:    1,
        memo:      'test',
      }),
    },
  },
}));

vi.mock('@/lib-client/pi/pi-auth', () => ({
  getAccessToken: vi.fn(() => 'test-token'),
  getStoredUser:  vi.fn(() => ({ id: 'user-1' })),
  waitForPiSDK:   vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib-client/pi/payment-timeouts', () => ({
  APPROVAL_TIMEOUT_MS:        60000,
  COMPLETION_TIMEOUT_MS:      60000,
  RETRIABLE_STATUS_CODES:     new Set([429]),
  NON_RETRIABLE_STATUS_CODES: new Set([400, 401, 403, 500]),
  MAX_RETRIES:                0,
  RETRY_BASE_DELAY_MS:        0,
}));

vi.mock('@/lib/request-id', () => ({
  buildHeaders:      vi.fn(() => ({ 'Content-Type': 'application/json' })),
  generateRequestId: vi.fn(() => 'test-uuid'),
  storeRequestId:    vi.fn(),
}));

import { getPaymentStatus, createA2UPayment } from '../pi-payment';

describe('pi-payment extended', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_GATEWAY_URL = 'https://api.example.com';
  });

  // ── getPaymentStatus ────────────────────────────────────
  describe('getPaymentStatus', () => {
    it('returns payment status from SDK', async () => {
      const result = await getPaymentStatus('pay-123');
      expect(result.status).toBe('completed');
      expect(result.amount).toBe(1);
    });

    it('throws when SDK fails', async () => {
      const { default: sdk } = await import('@/lib/sdk');
      vi.mocked(sdk.payment.getPayment).mockRejectedValueOnce(
        new Error('Payment not found')
      );

      await expect(getPaymentStatus('invalid-id')).rejects.toThrow('Payment not found');
    });
  });

  // ── createA2UPayment ────────────────────────────────────
  describe('createA2UPayment', () => {
    it('throws when no access token', async () => {
      const { getAccessToken } = await import('@/lib-client/pi/pi-auth');
      vi.mocked(getAccessToken).mockReturnValueOnce(null);

      await expect(
        createA2UPayment({ recipientUid: 'uid', amount: 1, memo: 'test' })
      ).rejects.toThrow('Unauthorized');
    });

    it('throws on non-ok response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok:     false,
        status: 400,
        json:   async () => ({ message: 'Bad request' }),
      } as Response);

      await expect(
        createA2UPayment({ recipientUid: 'uid', amount: 1, memo: 'test' })
      ).rejects.toThrow('Bad request');
    });

    it('sends correct body', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok:   true,
        status: 200,
        json: async () => ({ success: true, status: 'pending', amount: 5, memo: 'send' }),
      } as Response);

      await createA2UPayment({
        recipientUid: 'recipient-uid',
        amount:       5,
        memo:         'send',
        metadata:     { note: 'test' },
      });

      const body = JSON.parse(
        (fetchSpy.mock.calls[0][1] as RequestInit).body as string
      );
      expect(body.recipientUid).toBe('recipient-uid');
      expect(body.amount).toBe(5);
      expect(body.memo).toBe('send');
    });
  });
});
