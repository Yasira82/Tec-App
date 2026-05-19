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
    if (window.__TEC_PI_ERROR) {
      window.__TEC_PI_ERROR = false;
    }

    if (window.__TEC_PI_READY) {
      window.dispatchEvent(new Event('tec-pi-ready'));
      stableOnReady();
      return;
    }

    const POLL_INTERVAL = 250;
    const startTime     = Date.now();

    // ✅ mark ready بعد delay عشان Pi Browser يكمل native init
    const markReady = () => {
      setTimeout(() => {
        window.__TEC_PI_READY = true;
        window.dispatchEvent(new Event('tec-pi-ready'));
        stableOnReady();
      }, 1000);
    };

    function tryInit(): boolean {
      if (typeof window.Pi === 'undefined') return false;

      try {
        const elapsed = Date.now() - startTime;
        log(`[TEC] Pi SDK detected after ${elapsed}ms, calling Pi.init()`);

        const appId = process.env.NEXT_PUBLIC_PI_APP_ID;
        if (!appId) warn('[TEC] NEXT_PUBLIC_PI_APP_ID is not set — Pi.init() may fail');

        window.Pi.init({ version: '2.0', sandbox, ...(appId ? { appId } : {}) });
        log(`[TEC] Pi SDK initialized (sandbox: ${sandbox})`);

        markReady();
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);

        if (msg.toLowerCase().includes('already')) {
          log('[TEC] Pi SDK already initialized — marking as ready');
          markReady();
          return true;
        }

        warn('[TEC] Pi.init() failed, will retry:', msg);
        return false;
      }
    }

    if (tryInit()) return;

    const poll = setInterval(() => {
      if (tryInit()) { clearInterval(poll); return; }
      if (Date.now() - startTime >= timeout) {
        clearInterval(poll);
        err(`[TEC] Pi SDK not available after ${timeout}ms`);
        window.__TEC_PI_ERROR = true;
        window.dispatchEvent(new CustomEvent('tec-pi-error', { detail: { message: 'SDK load timeout' } }));
      }
    }, POLL_INTERVAL);

    return () => clearInterval(poll);
  }, [sandbox, timeout, stableOnReady]);

  return null;
}
