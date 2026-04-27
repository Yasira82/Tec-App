'use client';

import { useEffect } from 'react';

const isDev = process.env.NODE_ENV !== 'production';
const log   = (...args: unknown[]) => { if (isDev) console.log(...args); };
const warn  = (...args: unknown[]) => { if (isDev) console.warn(...args); };
const err   = (...args: unknown[]) => { if (isDev) console.error(...args); };

interface PiSdkLoaderProps {
  sandbox: boolean;
  timeout: number;
}

export default function PiSdkLoader({ sandbox, timeout }: PiSdkLoaderProps) {
  useEffect(() => {
    // ✅ لو فيه error سابق — reset وجرب تاني
    if (window.__TEC_PI_ERROR) {
      window.__TEC_PI_ERROR = false;
    }

    // ✅ لو ready بالفعل — dispatch event تاني عشان الـ listeners يشتغلوا
    if (window.__TEC_PI_READY) {
      window.dispatchEvent(new Event('tec-pi-ready'));
      return;
    }

    const POLL_INTERVAL = 250;
    const startTime     = Date.now();

    function tryInit(): boolean {
      if (typeof window.Pi === 'undefined') return false;

      try {
        const elapsed = Date.now() - startTime;
        log(`[TEC] Pi SDK detected after ${elapsed}ms, calling Pi.init()`);

        const appId = process.env.NEXT_PUBLIC_PI_APP_ID;
        if (!appId) {
          warn('[TEC] NEXT_PUBLIC_PI_APP_ID is not set — Pi.init() may fail');
        }

        window.Pi.init({ version: '2.0', sandbox, ...(appId ? { appId } : {}) });

        log(`[TEC] Pi SDK initialized (sandbox: ${sandbox})`);
        window.__TEC_PI_READY = true;
        window.dispatchEvent(new Event('tec-pi-ready'));
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);

        // ✅ لو already initialized — اعتبره ready
        if (msg.includes('already') || msg.includes('initialized')) {
          log('[TEC] Pi SDK already initialized — marking as ready');
          window.__TEC_PI_READY = true;
          window.dispatchEvent(new Event('tec-pi-ready'));
          return true;
        }

        err('[TEC] Pi.init() failed:', e);
        window.__TEC_PI_ERROR = true;
        window.dispatchEvent(new CustomEvent('tec-pi-error', { detail: e }));
        return true;
      }
    }

    if (tryInit()) return;

    const poll = setInterval(() => {
      if (tryInit()) {
        clearInterval(poll);
        return;
      }
      if (Date.now() - startTime >= timeout) {
        clearInterval(poll);
        err(`[TEC] Pi SDK not available after ${timeout}ms`);
        window.__TEC_PI_ERROR = true;
        window.dispatchEvent(
          new CustomEvent('tec-pi-error', { detail: { message: 'SDK load timeout' } }),
        );
      }
    }, POLL_INTERVAL);

    return () => clearInterval(poll);
  }, [sandbox, timeout]);

  return null;
}
