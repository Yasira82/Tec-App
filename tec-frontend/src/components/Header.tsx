'use client';

import { usePiAuth }        from '@/lib-client/hooks/usePiAuth';
import { useTranslation }   from '@/lib/i18n';
import LanguageSwitcher     from './LanguageSwitcher';

export default function Header() {
  const { user, isAuthenticated, logout } = usePiAuth();
  const { t } = useTranslation();

  return (
    <header style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        'var(--sp-4) var(--sp-6)',
      background:     'rgba(5,8,22,0.85)',
      backdropFilter: 'blur(24px) saturate(1.8)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
      borderBottom:   '1px solid var(--tec-border)',
      position:       'sticky',
      top:            0,
      zIndex:         100,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: 'linear-gradient(135deg,#F8B820,#D88810)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 13, color: '#0a0800',
          boxShadow: '0 2px 10px rgba(248,184,32,0.25)',
        }}>T</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--tec-gold)', letterSpacing: 1.5, lineHeight: 1 }}>
            {t.common.appName}
          </div>
          <div style={{ fontSize: 9, color: 'var(--tec-text-3)', letterSpacing: 2, lineHeight: 1.4 }}>ECOSYSTEM</div>
        </div>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
        <LanguageSwitcher />

        {isAuthenticated && user && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--tec-gold-glow)',
              border: '1px solid var(--tec-border-gold)',
              borderRadius: 'var(--radius-full)', padding: '5px 12px',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: 'linear-gradient(135deg,#F8B820,#D88810)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 800, color: '#0a0800',
              }}>
                {user.piUsername?.[0]?.toUpperCase()}
              </div>
              <span style={{ fontSize: 13, color: 'var(--tec-gold)', fontWeight: 600 }}>
                @{user.piUsername}
              </span>
            </div>

            <button
              onClick={logout}
              aria-label="Log out"
              style={{
                padding: 'var(--sp-2) var(--sp-4)',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 'var(--radius-sm)',
                color: 'rgba(239,68,68,0.7)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                transition: 'all var(--dur-base) ease',
              }}>
              {t.common.logout}
            </button>
          </>
        )}
      </div>
    </header>
  );
}
