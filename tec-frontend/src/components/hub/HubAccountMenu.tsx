'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter }         from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTranslation }    from '@/lib/i18n';
import { haptic }            from '@/lib/hub/utils';

/**
 * The account menu behind the header chip.
 *
 * Profile and Dashboard used to be two of seven tabs in the bottom nav, which
 * left the row at ~51px a slot and 8.5px labels. Neither is somewhere you go
 * repeatedly the way Wallet or the assistant are — they are "about me" and
 * "my numbers", which is what a chip carrying your own username is for. Moving
 * them here is what let the nav drop to five.
 *
 * A popover rather than a full sheet: two items do not deserve a screen, and
 * anchoring it under the chip keeps the connection to what was tapped.
 */
interface Props {
  open:     boolean;
  onClose:  () => void;
  username: string;
  /** The chip the menu hangs from. Only its bottom edge is used. */
  anchor:   React.RefObject<HTMLElement | null>;
}

export function HubAccountMenu({ open, onClose, username, anchor }: Props) {
  const router  = useRouter();
  const { t, dir } = useTranslation();
  const ref     = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);

  // The header is `overflow: hidden` (it has to be — the row escaping is what
  // gave the page a horizontal scrollbar), which would clip an absolutely
  // positioned child. A fixed element is laid out against the viewport, so
  // ancestor overflow does not reach it; the price is measuring the anchor.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (r) setTop(r.bottom + 6);
    };
    place();
    window.addEventListener('resize', place);
    // The header is sticky, so its position is stable while the page scrolls —
    // but not while the address bar collapses, which fires scroll.
    window.addEventListener('scroll', place, { passive: true });
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place);
    };
  }, [open, anchor]);

  // A menu that stays open when you tap the page behind it is a menu you have
  // to fight. Pointerdown, not click, so it closes on the same gesture that
  // starts a scroll.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const target = e.target as Node;
      // The chip is excluded: without this, tapping it while open closes here
      // on pointerdown and its own click reopens a moment later, so the menu
      // can never be dismissed by the control that summoned it.
      if (anchor.current?.contains(target)) return;
      if (ref.current && !ref.current.contains(target)) onClose();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open, onClose, anchor]);

  if (!open) return null;

  const go = (href: string) => () => { haptic('light'); onClose(); router.push(href); };

  const items: { icon: IconName; label: string; sub: string; action: () => void }[] = [
    { icon: 'user',  label: t.hub.account.profile,   sub: t.hub.account.profileSub,   action: go('/hub/profile') },
    { icon: 'chart', label: t.hub.account.dashboard, sub: t.hub.account.dashboardSub, action: go('/dashboard') },
  ];

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={t.hub.account.title}
      dir={dir}
      style={{
        position: 'fixed', top, insetInlineEnd: 12,
        // Above the sticky header (100) and the bottom nav (150).
        zIndex: 160,
        minWidth: 210, maxWidth: 'calc(100vw - 24px)',
        background: 'var(--tec-surface-1)',
        border: '1px solid var(--tec-border)',
        borderRadius: 14, padding: 6,
        boxShadow: '0 18px 40px rgba(0,0,0,0.45)',
        overflow: 'hidden',
      }}>

      <div style={{
        padding: '8px 10px 10px', borderBottom: '1px solid var(--tec-border)',
        marginBottom: 4,
      }}>
        <div dir="ltr" style={{
          fontSize: 13, fontWeight: 700, color: 'var(--tec-text-1)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          textAlign: dir === 'rtl' ? 'right' : 'left',
        }}>@{username}</div>
        <div style={{ fontSize: 10.5, color: 'var(--tec-text-3)', marginTop: 2 }}>
          {t.hub.account.title}
        </div>
      </div>

      {items.map(item => (
        <button
          key={item.label}
          role="menuitem"
          className="tec-nav-link"
          onClick={item.action}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 11,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '9px 10px', borderRadius: 10,
            textAlign: dir === 'rtl' ? 'right' : 'left',
          }}>
          <span style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: 'var(--tec-fill-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={item.icon} size={17} color="var(--tec-gold)" strokeWidth={1.9} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--tec-text-1)' }}>
              {item.label}
            </span>
            <span style={{ display: 'block', fontSize: 10.5, color: 'var(--tec-text-3)' }}>
              {item.sub}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
