'use client';

import { useRouter }      from 'next/navigation';
import { Icon }           from '@/components/ui/Icon';
import { useTranslation } from '@/lib/i18n';
import { haptic }         from '@/lib/hub/utils';

/**
 * The Hub's fixed bottom navigation — the one piece of chrome that is on screen
 * at every scroll position, which is why it, not the Platform Tools row, owns
 * the recurring destinations (Verify, Plan).
 */
export function HubBottomNav() {
  const router = useRouter();
  const { t }  = useTranslation();

  const items = [
    { icon: 'hub'      as const, label: t.hub.nav.hub,       active: true,  action: () => {} },
    { icon: 'wallet'   as const, label: t.hub.nav.wallet,    active: false, action: () => { haptic('light'); router.push('/dashboard/wallet'); } },
    // Labeled entry to the Dashboard. It used to be reachable ONLY by tapping the
    // header avatar, which reads as a name — not as a link to anything.
    { icon: 'chart'    as const, label: t.hub.nav.dashboard, active: false, action: () => { haptic('light'); router.push('/dashboard'); } },
    { icon: 'shield'   as const, label: t.hub.nav.verify,    active: false, action: () => { haptic('light'); router.push('/hub/kyc'); } },
    { icon: 'tiers'    as const, label: t.hub.nav.plan,      active: false, action: () => { haptic('light'); router.push('/hub/subscription'); } },
    { icon: 'settings' as const, label: t.hub.nav.settings,  active: false, action: () => { haptic('light'); router.push('/hub/profile'); } },
  ];

  return (
    <nav aria-label={t.hub.nav.main} style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'var(--tec-bg)',
      backdropFilter: 'blur(24px) saturate(1.8)', WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
      borderTop: '1px solid var(--tec-border)',
      display: 'flex', padding: '10px 4px',
      paddingBottom: 'max(10px, env(safe-area-inset-bottom))', zIndex: 150,
      // The nav owns the bottom strip of the screen — which is exactly where a
      // thumb swipes. Without this it eats every scroll that starts down here and
      // the page simply does not move. `pan-y` hands vertical drags to the page
      // and keeps taps for the buttons.
      touchAction: 'pan-y',
    }}>
      {items.map(item => (
        <button key={item.label} className="tec-nav-btn" onClick={item.action}
          aria-label={item.label} aria-current={item.active ? 'page' : undefined}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', position: 'relative' }}>
          {item.active && (
            <span style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', width: 24, height: 3, borderRadius: 999, background: 'var(--tec-gold-grad)', }} />
          )}
          <Icon name={item.icon} size={21} color={item.active ? 'var(--tec-gold)' : 'var(--tec-text-3)'} strokeWidth={item.active ? 2.2 : 1.9} />
          <span style={{ fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: item.active ? 700 : 400, color: item.active ? 'var(--tec-gold)' : 'var(--tec-text-3)' }}>
            {item.label}
          </span>
        </button>
      ))}
    </nav>
  );
}
