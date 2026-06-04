'use client';

import { piSession }                                             from './pi-session';
import { createU2APayment, createA2UPayment, getPaymentStatus } from './pi-payment';
import { loginWithPi, getAccessToken, getStoredUser, isPiBrowser } from './pi-auth';
import { piCircuitBreaker }                                      from './PiCircuitBreaker';
import type { PiPaymentData, PiPaymentCallbacks }                from '@/types/pi.types';
import type { PaymentResult }                                    from './pi-payment';

export { piCircuitBreaker };

export const PiRuntime = {
  isAvailable: (): boolean =>
    typeof window !== 'undefined' && typeof window.Pi !== 'undefined',

  isReady: (): boolean =>
    typeof window !== 'undefined' &&
    !!window.__TEC_PI_READY &&
    typeof window.Pi !== 'undefined',

  init: (sandbox: boolean, appId?: string): void =>
    piSession.reInit(sandbox, appId),

  createPayment: (data: PiPaymentData, callbacks: PiPaymentCallbacks): void => {
    if (typeof window === 'undefined' || !window.Pi) {
      callbacks.onError(new Error('Pi SDK not available'));
      return;
    }
    window.Pi.createPayment(data, callbacks);
  },

  createU2APayment: async (
    amount:        number,
    memo:          string,
    metadata:      Record<string, unknown> = {},
    internalId?:   string,
    onDiagnostic?: Parameters<typeof createU2APayment>[4],
  ): Promise<PaymentResult> => {
    if (!piCircuitBreaker.canAttempt()) {
      const { secondsTillRecovery } = piCircuitBreaker.stats();
      const msg = secondsTillRecovery > 0
        ? `Pi payments temporarily unavailable — try again in ${secondsTillRecovery}s`
        : 'Pi payments temporarily unavailable — please try again';
      return { success: false, status: 'error', amount, memo, message: msg };
    }

    const result = await createU2APayment(amount, memo, metadata, internalId, onDiagnostic);
    if (result.success && result.status === 'completed') piCircuitBreaker.onSuccess();
    else if (result.status === 'error')                  piCircuitBreaker.onFailure();
    return result;
  },

  circuitBreaker:  piCircuitBreaker,
  session:         piSession,
  createA2UPayment,
  getPaymentStatus,
  loginWithPi,
  getAccessToken,
  getStoredUser,
  isPiBrowser,
} as const;
