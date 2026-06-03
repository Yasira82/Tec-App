'use client';

import { piSession }                                             from './pi-session';
import { createU2APayment, createA2UPayment, getPaymentStatus } from './pi-payment';
import { loginWithPi, getAccessToken, getStoredUser, isPiBrowser } from './pi-auth';
import type { PiPaymentData, PiPaymentCallbacks }                from '@/types/pi.types';

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

  session:           piSession,
  createU2APayment,
  createA2UPayment,
  getPaymentStatus,
  loginWithPi,
  getAccessToken,
  getStoredUser,
  isPiBrowser,
} as const;
