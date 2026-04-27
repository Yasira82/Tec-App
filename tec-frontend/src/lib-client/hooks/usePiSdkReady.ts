'use client';

import { useState, useEffect } from 'react';
import { piSession, PiAuthError } from '@/lib-client/pi/pi-session';

export function usePiSdkReady(): {
  piReady:      boolean;
  lastError:    PiAuthError | null;
  ensurePiAuth: () => Promise<boolean>;
} {
  const [piReady,   setPiReady]   = useState(false);
  const [lastError, setLastError] = useState<PiAuthError | null>(null);

  useEffect(() => {
    const initSession = async () => {
      if (!window.Pi) return;
      const ok = await piSession.ensureAuth();
      setPiReady(ok);
      setLastError(piSession.lastError);
    };

    // ✅ Auth events
    const onAuthSuccess = () => { setPiReady(true);  setLastError(null); };
    const onAuthFailed  = (e: Event) => {
      setPiReady(false);
      setLastError((e as CustomEvent).detail?.error ?? 'UNKNOWN');
    };

    window.addEventListener('tec:pi:auth:success', onAuthSuccess);
    window.addEventListener('tec:pi:auth:failed',  onAuthFailed);

    // ✅ P2 Visibility resume recheck
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        initSession();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    if (window.__TEC_PI_READY && window.Pi) {
      initSession();
    } else {
      const onReady = () => initSession();
      window.addEventListener('tec-pi-ready', onReady, { once: true });

      const poll = setInterval(() => {
        if (window.__TEC_PI_READY && window.Pi) {
          clearInterval(poll);
          initSession();
        }
      }, 300);

      const timeout = setTimeout(() => {
        clearInterval(poll);
        if (window.Pi) initSession();
      }, 15000);

      return () => {
        window.removeEventListener('tec-pi-ready',        onReady);
        window.removeEventListener('tec:pi:auth:success', onAuthSuccess);
        window.removeEventListener('tec:pi:auth:failed',  onAuthFailed);
        document.removeEventListener('visibilitychange',  onVisible);
        clearInterval(poll);
        clearTimeout(timeout);
      };
    }

    return () => {
      window.removeEventListener('tec:pi:auth:success', onAuthSuccess);
      window.removeEventListener('tec:pi:auth:failed',  onAuthFailed);
      document.removeEventListener('visibilitychange',  onVisible);
    };
  }, []);

  return {
    piReady,
    lastError,
    ensurePiAuth: () => piSession.ensureAuth(),
  };
}
