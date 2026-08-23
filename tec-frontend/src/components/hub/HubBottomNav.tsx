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
 * FIVE slots, deliberately. It carried seven, and seven on a 360px phone is
 * ~51px each with 8.5px labels — a row you read rather than glance at. Profile
 * and Dashboard moved behind the header's account chip (HubAccountMenu): both
 * are "about me" rather than somewhere you go repeatedly, and Dashboard was
 * already reachable from that chip, so the tab was a second door to a room
 * that already had one.
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
    { icon: 'hub'    , label: t.hub.nav.hub,    active: true,  action: () => {} },
    { icon: 'tiers'  , label: t.hub.nav.plan,   active: false, action: () => { haptic('light'); router.push('/hub/subscription'); } },
    { icon: 'spark'  , label: t.hub.nav.ai, aria: t.hub.ai.open, active: false, raised: true, action: () => { haptic('medium'); onOpenAi(); } },
    { icon: 'shield' , label: t.hub.nav.verify, active: false, action: () => { haptic('light'); router.push('/hub/kyc'); } },
    // Wallet sits at the far end on purpose: it is the most-tapped destination
    // here, and the outermost slot is the shortest reach for a thumb holding
    // the phone — not the hardest, the way it is on a desktop toolbar.
    { icon: 'wallet' , label: t.hub.nav.wallet, active: false, action: () => { haptic('light'); router.push('/dashboard/wallet'); } },
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
          {/* Five slots on a 360px phone is ~72px each, so the label can go back
              to a readable size. It was squeezed to 8.5px only because seven
              tabs left ~51px and "DASHBOARD" would not fit. */}
          <span style={{ fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: item.active || item.raised ? 700 : 400, color: item.active || item.raised ? 'var(--tec-gold)' : 'var(--tec-text-3)' }}>
            {item.label}
          </span>
        </button>
      ))}
    </nav>
  );
}
