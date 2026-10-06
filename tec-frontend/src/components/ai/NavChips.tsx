'use client';

import type { NavIntent } from '@/lib/ai/nav-intents';
import { useHandoffLinks }  from '@/lib-client/handoff-links';
import { rememberReturn }   from '@/lib-client/return-to';
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
const defaultStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', borderRadius: 999,
  border: '1px solid var(--tec-gold)40', background: 'var(--tec-gold)12',
  color: 'var(--tec-gold)', fontSize: 12, fontWeight: 600,
  textDecoration: 'none', whiteSpace: 'nowrap',
};

/**
 * ONE chip. Exported so the /ai page can use it for a flow step and keep its own CSS
 * class — `className` opts out of the inline style entirely.
 *
 * It exists because the two surfaces drifted a THIRD time: the drawer got the app emoji
 * on its chips while /ai kept a private copy that still rendered a bare "تك". Sharing the
 * markup, not just the parser, is what actually stops that.
 */
export function NavChip({
  intent, dir, locale = 'en', className,
}: { intent: NavIntent; dir?: string; locale?: Locale; className?: string }) {
  const arrow = dir === 'rtl' ? '←' : '→';
  // The registry name alone can be a bare transliteration ("تك"), which reads as nothing
  // on a button. The emoji carries the app identity the Hub grid already taught the user.
  const label = intent.label ?? t(intent.name, locale);
  const content = (
    <>{intent.emoji && <span aria-hidden>{intent.emoji}</span>}{label} <span aria-hidden>{arrow}</span></>
  );

  // Plain anchors on purpose, internal paths included. next/link needs the app router
  // mounted; this renders inside a modal drawer that can be mounted in contexts without
  // it, and a chip that CRASHES the reply is worse than one that costs a full page load.
  const external = /^https?:\/\//.test(intent.href);
  // A3 (C-104 §10.1 · C-123 §12/§13): a chip that carries a pre-filled value
  // opens through the signed handoff — real link, new tab, no referrer — so the
  // person lands in the owning app signed in, on the form. Until the signed link
  // arrives (or if it cannot be had) the plain link is the fallback, never a
  // dead end. Other chips are unchanged.
  const signed = useHandoffLinks(intent.signed && external ? [intent.href] : [], Boolean(intent.signed && external));
  const href   = intent.signed && external ? signed(intent.href) : intent.href;
  const onClick = intent.signed && external
    ? () => {
        rememberReturn(window.location.pathname);
        signed.spent(intent.href); // refreshed after the tap, never inside it (C-123 §12, #259)
      }
    : undefined;
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...(onClick ? { onClick } : {})}
      {...(intent.signed ? { 'data-signed': 'true' } : {})}
      {...(className ? { className } : { style: defaultStyle })}
    >{content}</a>
  );
}

export function NavChips({
  intents, dir, locale = 'en', className,
}: { intents: NavIntent[]; dir?: string; locale?: Locale; className?: string }) {
  if (!intents.length) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
      {intents.map(intent => {
        const key = intent.action ? `${intent.slug}:${intent.action}` : intent.slug;
        return <NavChip key={key} intent={intent} dir={dir} locale={locale} className={className} />;
      })}
    </div>
  );
}
