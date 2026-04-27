'use client';

import { useEffect, useState } from 'react';

export interface PiBrowserInfo {
  isPiBrowser: boolean;
  isMobile:    boolean;
  isReady:     boolean;
}

export function usePiBrowser(): PiBrowserInfo {
  const [info, setInfo] = useState<PiBrowserInfo>({
    isPiBrowser: false,
    isMobile:    false,
    isReady:     false,
  });

  useEffect(() => {
    const ua       = navigator.userAgent;
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

    // ✅ UA check أولاً — مش بس window.Pi
    const uaIsPi =
      ua.includes('PiBrowser') ||
      ua.includes('Pi Network') ||
      ua.includes('MinePI');

    // ✅ لو UA مش Pi Browser — مش Pi Browser
    if (!uaIsPi) {
      setInfo({ isPiBrowser: false, isMobile, isReady: true });
      return;
    }

    // ✅ UA بيقول Pi Browser — انتظر الـ SDK
    if (window.__TEC_PI_READY || typeof window.Pi !== 'undefined') {
      setInfo({ isPiBrowser: true, isMobile, isReady: true });
      return;
    }

    // ✅ انتظر الـ SDK event
    const onReady = () => setInfo({ isPiBrowser: true, isMobile, isReady: true });
    const onError = () => setInfo({ isPiBrowser: true, isMobile, isReady: true }); // لسه Pi Browser حتى لو SDK فشل

    window.addEventListener('tec-pi-ready', onReady, { once: true });
    window.addEventListener('tec-pi-error', onError, { once: true });

    // ✅ fallback بعد 5 ثواني
    const timeout = setTimeout(() => {
      setInfo({ isPiBrowser: true, isMobile, isReady: true });
    }, 5000);

    return () => {
      window.removeEventListener('tec-pi-ready', onReady);
      window.removeEventListener('tec-pi-error', onError);
      clearTimeout(timeout);
    };
  }, []);

  return info;
}
