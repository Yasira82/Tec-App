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

    // ✅ لو Pi SDK موجود = Pi Browser بدون UA check
    if (typeof window.Pi !== 'undefined' || window.__TEC_PI_READY) {
      setInfo({ isPiBrowser: true, isMobile, isReady: true });
      return;
    }

    // ✅ UA check
    const uaIsPi =
      ua.includes('PiBrowser') ||
      ua.includes('Pi Network') ||
      ua.includes('MinePI');

    if (!uaIsPi) {
      // ✅ انتظر الـ SDK event — ممكن يـ load بعدين
      const onReady = () => setInfo({ isPiBrowser: true, isMobile, isReady: true });
      const onError = () => setInfo({ isPiBrowser: false, isMobile, isReady: true });

      window.addEventListener('tec-pi-ready', onReady, { once: true });
      window.addEventListener('tec-pi-error', onError, { once: true });

      // ✅ fallback بعد 5 ثواني
      const timeout = setTimeout(() => {
        // ✅ check تاني بعد الـ timeout
        const isPi = typeof window.Pi !== 'undefined' || !!window.__TEC_PI_READY;
        setInfo({ isPiBrowser: isPi, isMobile, isReady: true });
      }, 5000);

      return () => {
        window.removeEventListener('tec-pi-ready', onReady);
        window.removeEventListener('tec-pi-error', onError);
        clearTimeout(timeout);
      };
    }

    // ✅ UA بيقول Pi Browser — انتظر الـ SDK
    const onReady = () => setInfo({ isPiBrowser: true, isMobile, isReady: true });
    const onError = () => setInfo({ isPiBrowser: true, isMobile, isReady: true });

    window.addEventListener('tec-pi-ready', onReady, { once: true });
    window.addEventListener('tec-pi-error', onError, { once: true });

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
