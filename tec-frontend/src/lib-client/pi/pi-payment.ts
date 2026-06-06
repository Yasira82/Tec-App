import { getAccessToken, getStoredUser, waitForPiSDK } from './pi-auth';
import { piSession } from '@/lib-client/pi/pi-session';
import sdk           from '@/lib/sdk';
import { buildHeaders } from '@/lib/request-id';
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
  amount:       number;
  memo:         string;
  metadata?:    Record<string, unknown>;
}

export interface PaymentResult {
  success:    boolean;
  paymentId?: string;
  txid?:      string;
  status:     'created' | 'pending' | 'approved' | 'completed' | 'cancelled' | 'failed' | 'error';
  amount:     number;
  memo:       string;
  message?:   string;
}

export type DiagnosticCallback = (type: string, message: string, data?: unknown) => void;

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
};

const retryFetch = async (
  url:        string,
  options:    RequestInit,
  maxRetries = MAX_RETRIES,
): Promise<Response> => {
  let lastError: Error | null = null;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (NON_RETRIABLE_STATUS_CODES.has(response.status)) return response;
      if (RETRIABLE_STATUS_CODES.has(response.status) && i < maxRetries) {
        await new Promise(r => setTimeout(r, RETRY_BASE_DELAY_MS * (i + 1)));
        continue;
      }
      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown error');
      if (i < maxRetries) await new Promise(r => setTimeout(r, RETRY_BASE_DELAY_MS * (i + 1)));
    }
  }
  throw lastError ?? new Error('Request failed');
};

// ✅ A2U — App to User
export const createA2UPayment = async (data: A2UPaymentRequest): Promise<PaymentResult> => {
  const token = getAccessToken();
  if (!token) throw new Error('Unauthorized - Please log in first');

  const idempotencyKey = crypto.randomUUID();
  try {
    const response = await retryFetch('/api/payment/a2u', {
      method:      'POST',
      credentials: 'include',
      headers: {
        'Content-Type':    'application/json',
        Authorization:     `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey,
        'x-csrf-token':    getCsrfToken(),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error?.error?.message || error?.message || 'Failed to create A2U payment');
    }
    return response.json();
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to create A2U payment');
  }
};

const PI_PAYMENT_ID_REGEX = /^[a-zA-Z0-9]+([._-][a-zA-Z0-9]+)*$/;
const PI_TXID_REGEX       = /^[a-zA-Z0-9_-]{8,128}$/;

// ✅ U2A — User to App
// internalId: optional — if pre-created by caller (PaymentModal), skip self-create.
//             if omitted (direct callers), self-create internally.
export const createU2APayment = async (
  amount:        number,
  memo:          string,
  metadata:      Record<string, unknown> = {},
  internalId?:   string,           // ✅ optional — backward compat
  onDiagnostic?: DiagnosticCallback,
): Promise<PaymentResult> => {
  if (typeof window === 'undefined') throw new Error('Pi SDK not available - Open in Pi Browser');

  // ✅ unified gate: Pi.init() + Pi.authenticate()
  await piSession.ensurePaymentsReady();

  // ✅ self-create if caller didn't pre-create
  if (!internalId) {
    const storedUser = getStoredUser();
    const userId     = storedUser?.id ?? storedUser?.piId ?? null;
    if (userId) {
      try {
        onDiagnostic?.('info', 'Creating payment record', { userId, amount });
        const res = await fetch('/api/payment/create', {
          method:      'POST',
          credentials: 'include',
          headers: {
            ...buildHeaders(),
            Authorization:  `Bearer ${getAccessToken()}`,
            'x-csrf-token': getCsrfToken(),
          },
          body: JSON.stringify({ userId, amount, currency: 'PI', payment_method: 'pi', metadata }),
        });
        if (res.ok) {
          const data = await res.json();
          internalId = data?.data?.payment?.id ?? data?.data?.id ?? data?.data?.payment_id ?? undefined;
          onDiagnostic?.('info', 'Backend record created', { internalId });
        } else {
          const errStatus = res.status;
          onDiagnostic?.('error', `Backend create returned ${errStatus} — aborting Pi call`);
          const errMsg = errStatus === 401
            ? 'Session expired — please log out and log in again, then retry.'
            : `Payment setup failed (${errStatus}). Please try again.`;
          throw new Error(errMsg);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Backend create failed';
        onDiagnostic?.('error', `Backend create failed: ${msg}`);
        throw new Error(msg);
      }
    }
  }

  // C-76 ownership check: must have a valid internal payment record before calling Pi.
  // If internalId is missing here, Pi was never called — safe to throw.
  if (!internalId) {
    throw new Error('Payment setup failed — please try again.');
  }

  const sandbox = (window as { __PI_SANDBOX?: boolean }).__PI_SANDBOX === true;
  const appId   = process.env.NEXT_PUBLIC_PI_APP_ID;

  return new Promise((resolve, reject) => {
    if (!window.Pi) { reject(new Error('Pi SDK not available - Open in Pi Browser')); return; }

    let paymentTimedOut = false;
    let paymentTimer: ReturnType<typeof setTimeout> | null = null;

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

    // ✅ retry wrapper — defensive reInit + single retry on "not initialized"
    const invoke = (attempt: number) => {
      piSession.reInit(sandbox, appId);

      try {
        window.Pi!.createPayment(
          { amount, memo, metadata },
          {
            onReadyForServerApproval: async (piPaymentId: string) => {
              if (paymentTimedOut) return;
              onDiagnostic?.('approval', `onReadyForServerApproval: ${piPaymentId}`, { piPaymentId, internalId });

              if (!PI_PAYMENT_ID_REGEX.test(piPaymentId)) {
                clearPaymentTimer(); reject(new Error('Invalid payment ID format')); return;
              }
              // ✅ fail-fast — no silent bypass
              if (!internalId) {
                onDiagnostic?.('error', 'No internalId — cannot approve payment');
                clearPaymentTimer();
                reject(new Error('Payment setup failed. Please try again.'));
                return;
              }

              startApprovalTimer();
              try {
                const res = await fetch('/api/payment/approve', {
                  method:      'POST',
                  credentials: 'include',
                  headers: {
                    ...buildHeaders(),
                    Authorization:  `Bearer ${getAccessToken()}`,
                    'x-csrf-token': getCsrfToken(),
                  },
                  body: JSON.stringify({ payment_id: internalId, pi_payment_id: piPaymentId }),
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  throw new Error(err?.message ?? `Approval failed: ${res.status}`);
                }
                onDiagnostic?.('approval', 'Approval successful', { piPaymentId, internalId });
                startCompletionTimer();
              } catch (err) {
                const msg = err instanceof Error ? err.message : 'Approval failed';
                onDiagnostic?.('error', `Approval failed: ${msg}`);
                clearPaymentTimer(); reject(new Error(msg));
              }
            },

            onReadyForServerCompletion: async (piPaymentId: string, txid: string) => {
              if (paymentTimedOut) return;
              onDiagnostic?.('completion', 'onReadyForServerCompletion', { piPaymentId, txid, internalId });

              if (!PI_PAYMENT_ID_REGEX.test(piPaymentId)) {
                clearPaymentTimer(); reject(new Error('Invalid payment ID format')); return;
              }
              if (!PI_TXID_REGEX.test(txid)) {
                clearPaymentTimer(); reject(new Error('Invalid transaction ID format')); return;
              }
              // ✅ removed: unsafe resolve without backend
              if (!internalId) {
                clearPaymentTimer();
                reject(new Error('Payment setup failed — missing internalId'));
                return;
              }

              try {
                const res = await fetch('/api/payment/complete', {
                  method:      'POST',
                  credentials: 'include',
                  headers: {
                    ...buildHeaders(),
                    Authorization:  `Bearer ${getAccessToken()}`,
                    'x-csrf-token': getCsrfToken(),
                  },
                  body: JSON.stringify({ payment_id: internalId, transaction_id: txid }),
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  throw new Error(err?.message ?? `Completion failed: ${res.status}`);
                }
                onDiagnostic?.('completion', 'Completion successful', { piPaymentId, internalId, txid });
                clearPaymentTimer();
                resolve({ success: true, paymentId: piPaymentId, txid, amount, memo, status: 'completed', message: 'Payment successful! 🎉' });
              } catch (err) {
                const msg = err instanceof Error ? err.message : 'Payment failed';
                onDiagnostic?.('error', `Completion failed: ${msg}`);
                clearPaymentTimer(); reject(new Error(msg));
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

              // ✅ single retry on "not initialized"
              if (attempt === 0 && /not initialized|init\(\)/i.test(error.message)) {
                piSession.reset();
                piSession.ensurePaymentsReady().then(ok => {
                  if (ok) invoke(1);
                  else    reject(new Error(`Pi SDK error: ${error.message}`));
                });
                return;
              }

              if (/scope|permission|payments/i.test(error.message)) {
                piSession.reset();
                window.dispatchEvent(new CustomEvent('tec:pi:scope:lost'));
              }
              reject(new Error(`Pi SDK error: ${error.message}`));
            },
          },
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        clearPaymentTimer();

        if (attempt === 0 && /not initialized|init\(\)/i.test(msg)) {
          piSession.reset();
          piSession.ensurePaymentsReady().then(ok => {
            if (ok) invoke(1);
            else    reject(new Error(msg));
          });
          return;
        }
        reject(err instanceof Error ? err : new Error(msg));
      }
    };

    startApprovalTimer();
    invoke(0);
  });
};

export const getPaymentStatus = async (paymentId: string): Promise<PaymentResult> => {
  try {
    const result = await sdk.payment.getPayment(paymentId);
    return result as unknown as PaymentResult;
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to fetch payment status');
  }
};

export const testPiSDK = (): boolean => {
  if (typeof window === 'undefined') return false;
  return typeof window.Pi !== 'undefined';
};
