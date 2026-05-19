'use client';

import { useState, useEffect, useRef } from 'react';
import { piSession, PiAuthError }      from '@/lib-client/pi/pi-session';

export function usePiSdkReady(): {
  piReady:       boolean;
  authReady:     boolean;
  paymentsReady: boolean;
  lastError:     PiAuthError | null;
  ensurePiAuth:  () => Promise<boolean>;
} {
  const [piReady,       setPiReady]       = useState(false);
  const [authReady,     setAuthReady]     = useState(false);
  const [paymentsReady, setPaymentsReady] = useState(false);
  const [lastError,     setLastError]     = useState<PiAuthError | null>(null);

  // ✅ Guards — منع loops
  const isReauthing = useRef(false);
  const lastInitAt  = useRef(0);

  useEffect(() => {
    const initSession = async () => {
      if (!window.Pi) return;

      // ✅ SDK جاهز فوراً
      setPiReady(true);

      // ✅ Single readiness gate — drives paymentsReady, which is the only
      //    flag that should gate Pi.createPayment.
      const ok = await piSession.ensurePaymentsReady();
      setAuthReady(ok);
      setPaymentsReady(ok);
      setLastError(piSession.lastError);
    };

    // ✅ Auth events
    const onAuthSuccess = () => {
      setAuthReady(true);
      setPaymentsReady(true);
      setLastError(null);
    };
    const onAuthFailed  = (e: Event) => {
      setAuthReady(false);
      setPaymentsReady(false);
      setLastError((e as CustomEvent).detail?.error ?? 'UNKNOWN');
    };

    // ✅ Scope lost — مع guard منع loop
    const onScopeLost = async () => {
      if (isReauthing.current) return;
      isReauthing.current = true;
      setAuthReady(false);
      setPaymentsReady(false);
      const ok = await piSession.ensurePaymentsReady();
      setAuthReady(ok);
      setPaymentsReady(ok);
      isReauthing.current = false;
    };

    // ✅ Visibility resume — مع debounce 2s
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastInitAt.current < 2000) return;
      lastInitAt.current = Date.now();
      initSession();
    };

    window.addEventListener('tec:pi:auth:success', onAuthSuccess);
    window.addEventListener('tec:pi:auth:failed',  onAuthFailed);
    window.addEventListener('tec:pi:scope:lost',   onScopeLost);
    document.addEventListener('visibilitychange',  onVisible);

    if (window.__TEC_PI_READY && window.Pi) {
      lastInitAt.current = Date.now();
      initSession();
    } else {
      const onReady = () => {
        lastInitAt.current = Date.now();
        initSession();
      };
      window.addEventListener('tec-pi-ready', onReady, { once: true });

      const poll = setInterval(() => {
        if (window.__TEC_PI_READY && window.Pi) {
          clearInterval(poll);
          lastInitAt.current = Date.now();
          initSession();
        }
      }, 300);

      const timeout = setTimeout(() => {
        clearInterval(poll);
        if (window.Pi) {
          lastInitAt.current = Date.now();
          initSession();
        }
      }, 15000);

      return () => {
        window.removeEventListener('tec-pi-ready',        onReady);
        window.removeEventListener('tec:pi:auth:success', onAuthSuccess);
        window.removeEventListener('tec:pi:auth:failed',  onAuthFailed);
        window.removeEventListener('tec:pi:scope:lost',   onScopeLost);
        document.removeEventListener('visibilitychange',  onVisible);
        clearInterval(poll);
        clearTimeout(timeout);
      };
    }

    return () => {
      window.removeEventListener('tec:pi:auth:success', onAuthSuccess);
      window.removeEventListener('tec:pi:auth:failed',  onAuthFailed);
      window.removeEventListener('tec:pi:scope:lost',   onScopeLost);
      document.removeEventListener('visibilitychange',  onVisible);
    };
  }, []);

  return {
    piReady,
    authReady,
    paymentsReady,
    lastError,
    ensurePiAuth: () => piSession.ensurePaymentsReady(),
  };
}
