'use client';

import type { NavIntent } from '@/lib/ai/nav-intents';
import { t }                from '@/domains/_types';
import type { Locale }      from '@/domains/_types';

/**
 * The action chips that follow an assistant reply.
 *
 * The model marks a recommended destination inline (`[[go:nx]]`). The /ai page has always
 * run `parseNavIntents` to strip that marker and turn it into a chip; the Hub drawer never
 * did, so the raw `[[go:nx]]` was printed to the user as literal text — the marker is a
 * machine channel, and it was leaking into the product.
 *
 * Parsing is shared (`parseNavIntents`); this is the compact renderer for the drawer.
 * Chips are POINTERS, never actions — following one navigates, it never spends or commits
 * anything (C-104: TEC AI recommends and explains; the owning app executes).
 */
export function NavChips({
  intents, dir, locale = 'en',
}: { intents: NavIntent[]; dir?: string; locale?: Locale }) {
  if (!intents.length) return null;
  const arrow = dir === 'rtl' ? '←' : '→';

  const style: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 999,
    border: '1px solid #FBBF2440', background: '#FBBF2412',
    color: '#FBBF24', fontSize: 12, fontWeight: 600,
    textDecoration: 'none', whiteSpace: 'nowrap',
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
      {intents.map(intent => {
        // `intent.name` is a Localized {en, ar} OBJECT, not a string. Rendering it
        // straight into JSX throws "Objects are not valid as a React child", which
        // unmounts the whole reply — the answer vanished instead of showing a chip.
        const label   = intent.label ?? t(intent.name, locale);
        const content = <>{label} <span aria-hidden>{arrow}</span></>;
        const key     = intent.action ? `${intent.slug}:${intent.action}` : intent.slug;

        // Plain anchors on purpose, internal paths included. next/link needs the app
        // router mounted; this renders inside a modal drawer that can be mounted in
        // contexts without it, and a chip that CRASHES the reply is worse than one that
        // costs a full page load. Following a chip navigates away regardless.
        const external = /^https?:\/\//.test(intent.href);
        return (
          <a
            key={key}
            href={intent.href}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            style={style}
          >{content}</a>
        );
      })}
    </div>
  );
}
