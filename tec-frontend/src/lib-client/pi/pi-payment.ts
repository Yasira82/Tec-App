import { getAccessToken, getStoredUser, waitForPiSDK } from './pi-auth';
import sdk from '@/lib/sdk';
import {
  APPROVAL_TIMEOUT_MS,
  COMPLETION_TIMEOUT_MS,
  RETRIABLE_STATUS_CODES,
  NON_RETRIABLE_STATUS_CODES,
  MAX_RETRIES,
  RETRY_BASE_DELAY_MS,
} from './payment-timeouts';

export interface A2UPaymentRequest {
  recipientUid: string;
  amount: number;
  memo: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  txid?: string;
  status: 'created' | 'pending' | 'approved' | 'completed' | 'cancelled' | 'failed' | 'error';
  amount: number;
  memo: string;
  message?: string;
}

const retryFetch = async (
  url: string,
  options: RequestInit,
  maxRetries = MAX_RETRIES
): Promise<Response> => {
  let lastError: Error | null = null;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (NON_RETRIABLE_STATUS_CODES.has(response.status)) return response;
      if (RETRIABLE_STATUS_CODES.has(response.status) && i < maxRetries) {
        await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY_MS * (i + 1)));
        continue;
      }
      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown error');
      if (i < maxRetries) {
        await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY_MS * (i + 1)));
      }
    }
  }
  throw lastError || new Error('Request failed');
};

export const createA2UPayment = async (data: A2UPaymentRequest): Promise<PaymentResult> => {
  const token = getAccessToken();
  if (!token) throw new Error('Unauthorized - Please log in first');
  const idempotencyKey = crypto.randomUUID();
  try {
    const response = await retryFetch(
      `${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/api/payments/a2u`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(data),
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error?.error?.message || error?.message || 'Failed to create payment');
    }
    return response.json();
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to create payment');
  }
};

export type DiagnosticCallback = (type: string, message: string, data?: unknown) => void;

const PI_PAYMENT_ID_REGEX = /^[a-zA-Z0-9]+([._-][a-zA-Z0-9]+)*$/;
const PI_TXID_REGEX = /^[a-zA-Z0-9_-]{8,128}$/;

export const createU2APayment = async (
  amount: number,
  memo: string,
  metadata: Record<string, unknown> = {},
  onDiagnostic?: DiagnosticCallback
): Promise<PaymentResult> => {
  if (typeof window === 'undefined') {
    throw new Error('Pi SDK not available - Open in Pi Browser');
  }

  await waitForPiSDK();

  const idempotencyKey = crypto.randomUUID();
  let internalId: string | null = null;
  const storedUser = getStoredUser();
  const userId = storedUser?.id ?? null;

  if (userId) {
    try {
      onDiagnostic?.('info', `Creating payment record (userId: ${userId})`, { userId, amount });
      const payment = await sdk.payment.create({
        userId,
        amount,
        currency: 'PI',
        payment_method: 'pi',
        metadata,
      });
      internalId = payment?.id ?? null;
      onDiagnostic?.('info', `Backend record created (internalId: ${internalId})`, { internalId });
    } catch (createErr) {
      console.warn('[Pi Payment] Backend payment create error (non-blocking):', createErr);
      onDiagnostic?.('warn', 'Backend create failed — proceeding without internalId');
    }
  }

  if (userId && !internalId) {
    const errorMsg = 'Failed to create payment record — please try again later';
    onDiagnostic?.('error', errorMsg);
    return { success: false, status: 'error', amount, memo, message: errorMsg };
  }

  return new Promise((resolve, reject) => {
    if (!window.Pi) {
      reject(new Error('Pi SDK not available - Open in Pi Browser'));
      return;
    }

    let paymentTimedOut = false;
    let paymentTimer: NodeJS.Timeout | null = null;

    const startApprovalTimer = () => {
      if (paymentTimer) clearTimeout(paymentTimer);
      paymentTimer = setTimeout(() => {
        paymentTimedOut = true;
        reject(new Error('Payment approval timed out. Please try again.'));
      }, APPROVAL_TIMEOUT_MS);
    };

    const startCompletionTimer = () => {
      if (paymentTimer) clearTimeout(paymentTimer);
      paymentTimer = setTimeout(() => {
        paymentTimedOut = true;
        reject(new Error('Payment completion timed out. Please try again.'));
      }, COMPLETION_TIMEOUT_MS);
    };

    const clearPaymentTimer = () => {
      if (paymentTimer) { clearTimeout(paymentTimer); paymentTimer = null; }
    };

    startApprovalTimer();

    window.Pi.createPayment(
      { amount, memo, metadata },
      {
        onReadyForServerApproval: async (piPaymentId: string) => {
          if (paymentTimedOut) return;
          onDiagnostic?.('approval', `onReadyForServerApproval: ${piPaymentId}`, { piPaymentId, internalId });
          if (!PI_PAYMENT_ID_REGEX.test(piPaymentId)) {
            clearPaymentTimer();
            reject(new Error('Invalid payment ID format'));
            return;
          }
          if (!internalId) {
            onDiagnostic?.('error', 'No internalId — skipping approve', { piPaymentId });
            startCompletionTimer();
            return;
          }
          try {
            await sdk.payment.approve({ payment_id: internalId, pi_payment_id: piPaymentId });
            onDiagnostic?.('approval', `Approval successful (${internalId})`, { piPaymentId, internalId });
            startCompletionTimer();
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Approval failed';
            onDiagnostic?.('error', `Approval failed: ${msg}`, { piPaymentId, internalId });
            clearPaymentTimer();
            reject(new Error(msg));
          }
        },

        onReadyForServerCompletion: async (piPaymentId: string, txid: string) => {
          if (paymentTimedOut) return;
          onDiagnostic?.('completion', `onReadyForServerCompletion: ${piPaymentId} txid=${txid}`, { piPaymentId, txid, internalId });
          if (!PI_PAYMENT_ID_REGEX.test(piPaymentId)) {
            clearPaymentTimer();
            reject(new Error('Invalid payment ID format'));
            return;
          }
          if (!PI_TXID_REGEX.test(txid)) {
            clearPaymentTimer();
            reject(new Error('Invalid transaction ID format'));
            return;
          }
          if (!internalId) {
            clearPaymentTimer();
            resolve({
              success: false,
              paymentId: piPaymentId,
              txid,
              status: 'completed',
              amount,
              memo,
              message: 'Payment sent but not recorded — please contact support',
            });
            return;
          }
          try {
            const result = await sdk.payment.complete({
              payment_id: internalId,
              transaction_id: txid,
            });
            onDiagnostic?.('completion', `Completion successful (${internalId})`, { piPaymentId, internalId, txid });
            clearPaymentTimer();
            // ✅ status بعد ...result عشان يـoverride
            resolve({
              success: true,
              paymentId: piPaymentId,
              txid,
              amount,
              memo,
              message: 'Payment successful! 🎉',
              ...result,
              status: 'completed',
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Payment failed';
            onDiagnostic?.('error', `Completion failed: ${msg}`, { piPaymentId, internalId, txid });
            clearPaymentTimer();
            reject(new Error(msg));
          }
        },

        onCancel: () => {
          onDiagnostic?.('cancel', 'Payment cancelled by user');
          clearPaymentTimer();
          resolve({ success: false, status: 'cancelled', amount, memo, message: 'Payment cancelled' });
        },

        onError: (error: Error) => {
          onDiagnostic?.('error', `Pi SDK error: ${error.message}`);
          clearPaymentTimer();
          reject(new Error(`Pi SDK error: ${error.message}`));
        },
      }
    );
  });
};

export const getPaymentStatus = async (paymentId: string): Promise<PaymentResult> => {
  try {
    const result = await sdk.payment.getStatus(paymentId);
    return result as unknown as PaymentResult;
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to fetch payment status');
  }
};

export const testPiSDK = (): boolean => {
  if (typeof window === 'undefined') return false;
  return typeof window.Pi !== 'undefined';
};
