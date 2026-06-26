'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

interface CountUpProps {
  value:      number;
  decimals?:  number;
  duration?:  number;   // ms
  style?:     CSSProperties;
  className?: string;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Animated number — counts from the previous value up to `value` with an
 * easeOutCubic curve. Premium fintech feel on balances / portfolio totals.
 * Respects prefers-reduced-motion (snaps instantly). Pi-Browser-safe (rAF only).
 */
export function CountUp({ value, decimals = 2, duration = 900, style, className }: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef  = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) { setDisplay(value); fromRef.current = value; return; }

    const from  = fromRef.current;
    const to    = value;
    if (from === to) return;
    const start = performance.now();

    const tick = (now: number) => {
      const t     = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);   // easeOutCubic
      setDisplay(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else       fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  return (
    <span className={className} style={style}>
      {display.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </span>
  );
}
