'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import LanguageSwitcher  from '@/components/LanguageSwitcher';
import ThemeToggle      from '@/components/ThemeToggle';
import { haptic }    from '@/lib/hub/utils';
import { Icon }      from '@/components/ui/Icon';
import { TecMark }   from '@/components/ui/TecMark';

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
      padding: '14px 16px 16px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100,
      // NO band here. The band (--tec-topbar) marks a page you navigated INTO
      // and can come back from; the Hub is the ground floor, so a band on it
      // framed the home screen as if it were a sub-page. It stays on the inner
      // pages — HubSubShell and the dashboard — where it means something.
      // Opaque, because the header is sticky and content scrolls under it.
      background: 'var(--tec-bg)',
      borderBottom: 'none',
      // A header that overflows does not just look wrong — it gives the whole page
      // a horizontal scrollbar and slides the account chip past the screen edge.
      // Everything inside is allowed to shrink; nothing is allowed to escape.
      gap: 8, overflow: 'hidden',
      // The header is sticky, so it sits over the content the whole way down.
      // `pan-y` lets a drag that starts on it scroll the page instead of stopping
      // dead on a button.
      touchAction: 'pan-y',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {/* The brand monogram, replacing a gold tile with a bare "T" in it —
            which was the first letter of the logo standing in for the logo. */}
        <TecMark size={22} color="var(--tec-gold)" />
        {/* The wordmark could not shrink: a flex item defaults to min-width:auto, so
            "ECOSYSTEM" — wider than "TEC" at letter-spacing 2 — held the whole block
            at its natural width and pushed the row past the screen. The header's
            `overflow: hidden` then cut it, and because the right-hand group paints
            later, the tail slid UNDER the language chip. Allowed to shrink, it
            truncates cleanly instead. */}
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--tec-gold)', letterSpacing: 1.5, lineHeight: 1 }}>TEC</div>
          <div style={{ fontSize: 9, color: 'var(--tec-text-3)', letterSpacing: 1.2, lineHeight: 1.4, whiteSpace: 'nowrap' }}>{t.hub.header.ecosystem}</div>
        </div>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexShrink: 1 }}>
        {/* The phone already shows the time in its status bar. Here it is the first
            thing to drop when the row runs out of room. */}
        <span className="tec-hide-narrow" style={{ fontSize: 11, color: 'var(--tec-text-3)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0 }}>{time}</span>

        <ThemeToggle compact />
        <LanguageSwitcher compact />

        {/* Notifications */}
        <button className="tec-btn" onClick={onNotifClick}
          aria-label={`${t.hub.header.notifications}${notifCount > 0 ? ` — ${notifCount}` : ''}`}
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: notifCount > 0 ? 'var(--tec-gold-dim)' : 'var(--tec-fill-soft)',
            border: `1px solid ${notifCount > 0 ? 'var(--tec-border-gold)' : 'var(--tec-border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', position: 'relative', flexShrink: 0,
          }}>
          <Icon name="bell" size={18} color={notifCount > 0 ? 'var(--tec-gold)' : 'var(--tec-text-2)'} />
          {notifCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, insetInlineEnd: -4,
              minWidth: 17, height: 17, borderRadius: 999,
              background: 'var(--tec-red)', border: '2px solid var(--tec-topbar)',
              fontSize: 9, fontWeight: 800, color: 'var(--tec-on-red)',
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
            background: notifCount > 0 ? 'var(--tec-gold-dim)' : 'var(--tec-fill-soft)',
            border: `1px solid ${notifCount > 0 ? 'var(--tec-border-gold)' : 'var(--tec-border)'}`,
            borderRadius: 12, padding: '5px 10px 5px 5px', cursor: 'pointer',
            minWidth: 0, flexShrink: 1,
          }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            background: 'var(--tec-gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: 'var(--tec-on-gold)',
          }}>
            {piUsername[0]?.toUpperCase()}
          </div>
          <span dir="ltr" style={{ fontSize: 12, color: 'var(--tec-gold)', fontWeight: 600, maxWidth: 84, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{piUsername}</span>
          <span aria-hidden style={{ fontSize: 13, lineHeight: 1, color: 'var(--tec-gold)', opacity: 0.6, marginInlineStart: -2 }}>›</span>
        </button>
      </div>
    </header>
  );
}
