'use client';

import { useRouter }      from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTranslation } from '@/lib/i18n';
import { haptic }         from '@/lib/hub/utils';

/**
 * The Hub's fixed bottom navigation — the one piece of chrome that is on screen
 * at every scroll position, which is why it, not the Platform Tools row, owns
 * the recurring destinations (Verify, Plan).
 *
 * The assistant lives here too, as the raised centre item. It used to be a
 * floating gold disc pinned over the page at bottom-right — and the apps grid
 * underneath it is a dense four-column lattice of tap targets, so the disc sat
 * permanently on top of one of them (it covered "Insure"). A control that
 * blocks a control is not a placement problem you can tune; the fix is to give
 * it a slot. Raised and filled, it keeps the prominence the disc had without
 * standing on anything.
 */
export function HubBottomNav({ onOpenAi }: { onOpenAi: () => void }) {
  const router = useRouter();
  const { t }  = useTranslation();

  const items: { icon: IconName; label: string; aria?: string; active: boolean; raised?: boolean; action: () => void }[] = [
    { icon: 'hub'             , label: t.hub.nav.hub,       active: true,  action: () => {} },
    { icon: 'wallet'          , label: t.hub.nav.wallet,    active: false, action: () => { haptic('light'); router.push('/dashboard/wallet'); } },
    // Labeled entry to the Dashboard. It used to be reachable ONLY by tapping the
    // header avatar, which reads as a name — not as a link to anything.
    { icon: 'chart'           , label: t.hub.nav.dashboard, active: false, action: () => { haptic('light'); router.push('/dashboard'); } },
    { icon: 'spark'           , label: t.hub.nav.ai, aria: t.hub.ai.open, active: false, raised: true, action: () => { haptic('medium'); onOpenAi(); } },
    { icon: 'shield'          , label: t.hub.nav.verify,    active: false, action: () => { haptic('light'); router.push('/hub/kyc'); } },
    { icon: 'tiers'           , label: t.hub.nav.plan,      active: false, action: () => { haptic('light'); router.push('/hub/subscription'); } },
    { icon: 'settings'        , label: t.hub.nav.settings,  active: false, action: () => { haptic('light'); router.push('/hub/profile'); } },
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
          aria-label={item.aria ?? item.label} aria-current={item.active ? 'page' : undefined}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', position: 'relative' }}>
          {item.active && (
            <span style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', width: 24, height: 3, borderRadius: 999, background: 'var(--tec-gold)', }} />
          )}
          {item.raised ? (
            <span style={{
              width: 34, height: 34, borderRadius: 12, marginTop: -9, marginBottom: -1,
              background: 'var(--tec-gold)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={item.icon} size={20} color="var(--tec-on-gold)" strokeWidth={2} />
            </span>
          ) : (
            <Icon name={item.icon} size={21} color={item.active ? 'var(--tec-gold)' : 'var(--tec-text-3)'} strokeWidth={item.active ? 2.2 : 1.9} />
          )}
          {/* Seven slots on a 360px phone is ~51px each. At the old 9px/0.8 the
              longest label ("DASHBOARD") measured wider than its slot and would
              have wrapped or clipped. */}
          <span style={{ fontSize: 8.5, letterSpacing: 0.3, textTransform: 'uppercase', fontWeight: item.active || item.raised ? 700 : 400, color: item.active || item.raised ? 'var(--tec-gold)' : 'var(--tec-text-3)' }}>
            {item.label}
          </span>
        </button>
      ))}
    </nav>
  );
}
