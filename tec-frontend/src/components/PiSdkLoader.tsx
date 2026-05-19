'use client';

import { useEffect, useCallback } from 'react';

interface Props { sandbox: boolean; timeout: number; onReady?: () => void; }

export default function PiSdkLoader({ sandbox, timeout, onReady }: Props) {
  const stableOnReady = useCallback(() => onReady?.(), [onReady]);

  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_PI_APP_ID;

    const callInit = (): boolean => {
      if (typeof window.Pi === 'undefined') return false;
      try {
        window.Pi.init({ version: '2.0', sandbox, ...(appId ? { appId } : {}) });
      } catch (e) {
        const msg = e instanceof Error ? e.message.toLowerCase() : '';
        if (!msg.includes('already')) return false;
      }
      // ✅ mark ready synchronously — no setTimeout hack
      window.__TEC_PI_READY = true;
      window.dispatchEvent(new Event('tec-pi-ready'));
      stableOnReady();
      return true;
    };

    // ✅ re-init on bfcache restore (Pi Browser drops bridge on background)
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        window.__TEC_PI_READY = false;
        callInit();
      }
    };
    window.addEventListener('pageshow', onPageShow);

    if (callInit()) return () => window.removeEventListener('pageshow', onPageShow);

    const startTime = Date.now();
    const poll = setInterval(() => {
      if (callInit()) { clearInterval(poll); return; }
      if (Date.now() - startTime >= timeout) {
        clearInterval(poll);
        window.__TEC_PI_ERROR = true;
        window.dispatchEvent(new CustomEvent('tec-pi-error', {
          detail: { message: 'SDK load timeout' },
        }));
      }
    }, 100);

    return () => {
      clearInterval(poll);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [sandbox, timeout, stableOnReady]);

  return null;
}
