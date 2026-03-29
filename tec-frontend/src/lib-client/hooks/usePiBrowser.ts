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
    const ua          = navigator.userAgent;
    const isPiBrowser = ua.includes('PiBrowser') || ua.includes('Pi Network') || typeof window.Pi !== 'undefined';
    const isMobile    = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

    setInfo({ isPiBrowser, isMobile, isReady: true });
  }, []);

  return info;
}
