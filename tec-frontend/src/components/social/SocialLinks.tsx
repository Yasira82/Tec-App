'use client';

import { activeSocial } from '@/lib/social';

/**
 * The brand marks, inline.
 *
 * `@yasser172/tec-ui`'s icon set has no social glyphs, and a generic `globe`
 * for all five would be worse than none — a person recognises these shapes
 * before they read a word, which is the entire reason the row works at all.
 *
 * Painted through CSS custom properties, the Hub's own convention: a hex
 * literal in an inline style is decided at render and cannot follow the theme
 * (C-83 §5.5). The marks themselves use `currentColor`, so they inherit
 * whatever the link is set to.
 *
 * This is a COPY of the same component in Tec-Life. It belongs in
 * `@yasser172/tec-ui` so 24 apps share one, and it will move there once both
 * surfaces are seen working — the fleet has paid for premature sweeps four
 * times this session, and for un-swept duplication just as often.
 */
const MARKS: Record<string, React.ReactNode> = {
  connection: (
    // Ours: two nodes and the edge between them — a graph, which is what
    // Connection is (C-107).
    <>
      <circle cx="7" cy="7" r="2.6" /><circle cx="17" cy="17" r="2.6" />
      <path d="M9 9l6 6" />
    </>
  ),
  telegram: <path d="M21.5 4.3 2.9 11.4c-.9.3-.9 1.6 0 1.9l4.7 1.5 1.8 5.4c.3.8 1.3 1 1.9.4l2.6-2.6 4.6 3.4c.7.5 1.7.1 1.9-.7L22.9 5.5c.2-.9-.6-1.5-1.4-1.2Z" />,
  whatsapp: (
    <>
      <path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.6-4.3a8.5 8.5 0 1 1 15.4-4.6Z" />
      <path d="M8.9 9.1c.3-.7.6-.7.9-.7h.6c.2 0 .5 0 .7.5l.8 1.9c.1.2 0 .4-.1.6l-.4.5c-.1.2-.3.3-.1.6a6 6 0 0 0 2.8 2.4c.3.1.5.1.6-.1l.6-.7c.2-.2.4-.2.6-.1l1.8.9c.2.1.4.2.4.4a2 2 0 0 1-1.4 1.7c-.6.2-1.4.2-3.4-.7a9 9 0 0 1-3.9-3.8c-.7-1.3-.8-2.3-.5-3.4Z" />
    </>
  ),
  facebook: <path d="M14.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5H17.6V4.4a21 21 0 0 0-2.4-.1c-2.4 0-4 1.4-4 4.1v2.1H8.5v3h2.7V21Z" />,
  x: <path d="M4 4h3.9l4.5 6 5.2-6H21l-6.9 7.9L21.4 21h-3.9l-4.8-6.4L7.1 21H4.4l7.3-8.4Z" />,
};

/**
 * A quiet row, not a call to action.
 *
 * It sits in the landing footer and in the dashboard sidebar — the two places
 * someone looks when the question is "is anyone actually behind this?", which
 * they ask once, usually before trusting the platform with a payment.
 */
export function SocialLinks({ compact = false }: { compact?: boolean }) {
  const links = activeSocial();
  // Nothing configured → render nothing at all. An empty bordered row under a
  // "Follow us" heading is worse than silence.
  if (links.length === 0) return null;

  const size = compact ? 34 : 38;

  return (
    <nav
      aria-label="TEC on social"
      style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}
    >
      {links.map((s) => (
        <a
          key={s.key}
          href={s.href}
          target="_blank"
          // noopener is the security half (the opened page cannot reach
          // window.opener); noreferrer stops our URL leaking to a third party.
          rel="noopener noreferrer"
          // The icon is the only content, so the accessible name has to come
          // from here — otherwise a screen reader announces five empty links.
          aria-label={s.label}
          title={s.label}
          style={{
            width: size, height: size, borderRadius: 10,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--tec-fill-soft)', border: '1px solid var(--tec-border)',
            color: 'var(--tec-text-3)', textDecoration: 'none',
            transition: 'color .15s, border-color .15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--tec-gold)';
            e.currentTarget.style.borderColor = 'var(--tec-border-gold)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--tec-text-3)';
            e.currentTarget.style.borderColor = 'var(--tec-border)';
          }}
        >
          <svg
            width={compact ? 16 : 18} height={compact ? 16 : 18} viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth={1.7}
            strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true" focusable="false"
          >
            {MARKS[s.key]}
          </svg>
        </a>
      ))}
    </nav>
  );
}
