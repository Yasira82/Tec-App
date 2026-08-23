'use client';

import Link from 'next/link';

interface Props {
  mobileOpen: boolean;
  onToggle:   () => void;
}

export function MobileTopbar({ mobileOpen, onToggle }: Props) {
  return (
    <div
      className="tec-mobile-topbar"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        zIndex: 'var(--z-topbar)' as unknown as number,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        background: 'rgba(5,8,22,0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
      <Link href="/hub" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'linear-gradient(135deg,#F8B820,#D88810)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 11, color: '#0a0800',
        }}>T</div>
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
          background: mobileOpen ? 'rgba(248,184,32,0.1)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${mobileOpen ? 'rgba(248,184,32,0.25)' : 'rgba(255,255,255,0.08)'}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 4, cursor: 'pointer', padding: 0,
        }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 16, height: 1.5, borderRadius: 999, display: 'block',
            background: mobileOpen ? 'var(--tec-gold)' : 'rgba(255,255,255,0.6)',
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
