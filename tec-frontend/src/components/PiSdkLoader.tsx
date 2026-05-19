'use client';

import { useEffect, useCallback } from 'react';

const isDev = process.env.NODE_ENV !== 'production';
const log   = (...args: unknown[]) => { if (isDev) console.log(...args); };
const warn  = (...args: unknown[]) => { if (isDev) console.warn(...args); };
const err   = (...args: unknown[]) => { if (isDev) console.error(...args); };

interface PiSdkLoaderProps {
  sandbox:  boolean;
  timeout:  number;
  onReady?: () => void;
}

export default function PiSdkLoader({ sandbox, timeout, onReady }: PiSdkLoaderProps) {
  const stableOnReady = useCallback(() => { onReady?.(); }, [onReady]);

  useEffect(() => {
    if (window.__TEC_PI_ERROR) window.__TEC_PI_ERROR = false;

    const appId     = process.env.NEXT_PUBLIC_PI_APP_ID;
    if (!appId) warn('[TEC] NEXT_PUBLIC_PI_APP_ID is not set — Pi.init() may fail');

    const startTime = Date.now();
    let cancelled   = false;

    const markReady = () => {
      window.__TEC_PI_READY = true;
      window.dispatchEvent(new Event('tec-pi-ready'));
      stableOnReady();
    };

    const callInit = (): boolean => {
      if (typeof window.Pi === 'undefined') return false;
      try {
        log(`[TEC] Pi SDK detected after ${Date.now() - startTime}ms, calling Pi.init()`);
        window.Pi.init({ version: '2.0', sandbox, ...(appId ? { appId } : {}) });
        log(`[TEC] Pi SDK initialized (sandbox: ${sandbox})`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.toLowerCase().includes('already')) {
          warn('[TEC] Pi.init() failed, will retry:', msg);
          return false;
        }
        log('[TEC] Pi SDK already initialized — marking as ready');
      }
      markReady();
      return true;
    };

    // ✅ bfcache restore — Pi Browser drops native bridge state on background.
    //    On restore, force a re-init so the next payment doesn't see a stale bridge.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        window.__TEC_PI_READY = false;
        callInit();
      }
    };
    window.addEventListener('pageshow', onPageShow);

    if (window.__TEC_PI_READY && window.Pi) {
      // Already ready on mount — emit event so late listeners catch up.
      window.dispatchEvent(new Event('tec-pi-ready'));
      stableOnReady();
      return () => window.removeEventListener('pageshow', onPageShow);
    }

    if (callInit()) {
      return () => window.removeEventListener('pageshow', onPageShow);
    }

    const poll = setInterval(() => {
      if (cancelled) { clearInterval(poll); return; }
      if (callInit()) { clearInterval(poll); return; }
      if (Date.now() - startTime >= timeout) {
        clearInterval(poll);
        err(`[TEC] Pi SDK not available after ${timeout}ms`);
        window.__TEC_PI_ERROR = true;
        window.dispatchEvent(new CustomEvent('tec-pi-error', { detail: { message: 'SDK load timeout' } }));
      }
    }, 100);

    return () => {
      cancelled = true;
      clearInterval(poll);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [sandbox, timeout, stableOnReady]);

  return null;
}
