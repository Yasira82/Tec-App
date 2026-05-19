'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createU2APayment, testPiSDK, PaymentResult, DiagnosticCallback } from '@/lib-client/pi/pi-payment';
import { isPiBrowser } from '@/lib-client/pi/pi-auth';

interface PaymentState {
  isProcessing: boolean;
  lastPayment: PaymentResult | null;
  error: string | null;
  errorType: 'not_pi_browser' | 'timeout' | 'approval_failed' | 'completion_failed' | 'sdk_error' | null;
  sdkAvailable: boolean;
}

interface UsePiPaymentOptions {
  onDiagnostic?: DiagnosticCallback;
}

export const usePiPayment = (options?: UsePiPaymentOptions) => {
  const [state, setState] = useState<PaymentState>({
    isProcessing: false,
    lastPayment: null,
    error: null,
    errorType: null,
    sdkAvailable: isPiBrowser(),
  });
  
  // Track if component is mounted for cleanup
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const onDiagnostic = options?.onDiagnostic;

  const payDemoPi = useCallback(async (amount: number = 1) => {
    if (!isMountedRef.current) return;
    
    setState(prev => ({ ...prev, isProcessing: true, error: null, errorType: null }));
    try {
      const result = await createU2APayment(
  amount,
  `TEC Demo Payment - ${amount} Pi`,
  { type: 'demo' },
  undefined,     // internalId — self-creates internally
  onDiagnostic,
);
      
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setState(prev => ({
          ...prev,
          isProcessing: false,
          lastPayment: result,
          error: null,
          errorType: null,
        }));
      }
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'فشل الدفع';
      
      // Determine error type based on error message
      let errorType: PaymentState['errorType'] = 'sdk_error';
      if (message.includes('Pi SDK') || message.includes('Pi Browser')) {
        errorType = 'not_pi_browser';
      } else if (message.includes('timed out') || message.includes('انتهت مهلة')) {
        errorType = 'timeout';
      } else if (message.includes('Approval') || message.includes('الموافقة')) {
        errorType = 'approval_failed';
      } else if (message.includes('Completion') || message.includes('الإكمال')) {
        errorType = 'completion_failed';
      }
      
      // Log error to diagnostics
      onDiagnostic?.('error', message, { errorType });
      
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setState(prev => ({
          ...prev,
          isProcessing: false,
          error: message,
          errorType,
        }));
      }
      throw err;
    }
  }, [onDiagnostic]);

  const testSDK = useCallback(() => {
    const available = testPiSDK();
    if (isMountedRef.current) {
      setState(prev => ({ ...prev, sdkAvailable: available }));
    }
    return available;
  }, []);

  const resetPayment = useCallback(() => {
    if (isMountedRef.current) {
      setState(prev => ({ ...prev, lastPayment: null, error: null, errorType: null }));
    }
  }, []);

  return { ...state, payDemoPi, testSDK, resetPayment };
};
