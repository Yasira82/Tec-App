'use client';

import Link       from 'next/link';
import { TecMark } from '@/components/ui/TecMark';

interface Props {
  mobileOpen: boolean;
  onToggle:   () => void;
}

export function MobileTopbar({ mobileOpen, onToggle }: Props) {
  return (
    <div
      className="tec-mobile-topbar tec-on-band"
      style={{
        // Sticky, not fixed: fixed took it out of the flow and painted it on
        // top of the "open in Pi Browser" banner above it.
        position: 'sticky', top: 0,
        zIndex: 'var(--z-topbar)' as unknown as number,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px 16px',
        background: 'var(--tec-topbar)',
        borderRadius: '0 0 var(--tec-topbar-radius) var(--tec-topbar-radius)',
      }}>
      <Link href="/hub" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
        {/* Same monogram as the Hub header — the two topbars are the same
            object on two screens and must not carry different marks. */}
        <TecMark size={19} color="var(--tec-gold)" />
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--tec-gold)', letterSpacing: 1.5 }}>TEC</span>
      </Link>

      <button
        onClick={onToggle}
        className="tec-btn"
        aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={mobileOpen}
        aria-controls="tec-sidebar"
        style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--tec-fill-soft)',
          border: '1px solid var(--tec-border)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 4, cursor: 'pointer', padding: 0,
        }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 16, height: 1.5, borderRadius: 999, display: 'block',
            background: mobileOpen ? 'var(--tec-gold)' : 'var(--tec-text-1)',
            transform: mobileOpen
              ? i === 0 ? 'rotate(45deg) translate(4px,4px)'
              : i === 2 ? 'rotate(-45deg) translate(4px,-4px)'
              : 'scale(0)'
              : 'none',
            transition: 'all 0.2s ease',
            transformOrigin: 'center',
          }} />
        ))}
      </button>
    </div>
  );
}
