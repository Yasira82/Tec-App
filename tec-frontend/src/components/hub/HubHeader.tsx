'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import LanguageSwitcher  from '@/components/LanguageSwitcher';
import { haptic }    from '@/lib/hub/utils';
import { Icon }      from '@/components/ui/Icon';

interface Props {
  piUsername:  string;
  time:        string;
  notifCount:  number;
  onNotifClick: () => void;
}

export function HubHeader({ piUsername, time, notifCount, onNotifClick }: Props) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <header style={{
      padding: '14px 20px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(5,8,22,0.85)',
      backdropFilter: 'blur(24px) saturate(1.8)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      // A header that overflows does not just look wrong — it gives the whole page
      // a horizontal scrollbar and slides the account chip past the screen edge.
      // Everything inside is allowed to shrink; nothing is allowed to escape.
      gap: 8, overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg,#FBBF24,#F59E0B)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 13, color: '#0a0800',
          boxShadow: '0 2px 12px rgba(251,191,36,0.3)',
        }}>T</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#FBBF24', letterSpacing: 1.5, lineHeight: 1 }}>TEC</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', letterSpacing: 2, lineHeight: 1.4 }}>{t.hub.header.ecosystem}</div>
        </div>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexShrink: 1 }}>
        {/* The phone already shows the time in its status bar. Here it is the first
            thing to drop when the row runs out of room. */}
        <span className="tec-hide-narrow" style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0 }}>{time}</span>

        <LanguageSwitcher compact />

        {/* Notifications */}
        <button className="tec-btn" onClick={onNotifClick}
          aria-label={`${t.hub.header.notifications}${notifCount > 0 ? ` — ${notifCount}` : ''}`}
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: notifCount > 0 ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${notifCount > 0 ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.08)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', position: 'relative', flexShrink: 0,
          }}>
          <Icon name="bell" size={18} color={notifCount > 0 ? '#FBBF24' : 'rgba(255,255,255,0.6)'} />
          {notifCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, insetInlineEnd: -4,
              minWidth: 17, height: 17, borderRadius: 999,
              background: '#ef4444', border: '2px solid #050816',
              fontSize: 9, fontWeight: 800, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 3px',
            }}>
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </button>

        {/* Avatar → Dashboard. The chevron is the affordance: without it this reads as
            a name label, so users never discovered it opens the Dashboard. */}
        <button className="tec-btn" onClick={() => { haptic('light'); router.push('/dashboard'); }}
          aria-label={t.hub.header.openDashboard}
          title={t.hub.header.openDashboard}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(251,191,36,0.08)',
            border: '1px solid rgba(251,191,36,0.2)',
            borderRadius: 12, padding: '5px 10px 5px 5px', cursor: 'pointer',
            minWidth: 0, flexShrink: 1,
          }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            background: 'linear-gradient(135deg,#FBBF24,#F59E0B)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: '#0a0800',
          }}>
            {piUsername[0]?.toUpperCase()}
          </div>
          <span style={{ fontSize: 12, color: '#FBBF24', fontWeight: 600, maxWidth: 84, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{piUsername}</span>
          <span aria-hidden style={{ fontSize: 13, lineHeight: 1, color: 'rgba(251,191,36,0.6)', marginInlineStart: -2 }}>›</span>
        </button>
      </div>
    </header>
  );
}
