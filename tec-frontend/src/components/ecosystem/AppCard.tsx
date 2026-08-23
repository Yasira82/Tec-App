'use client';

import { type EcosystemApp } from '@/lib/apps';
import { categoryMeta } from '@/domains/_categories';
import { t, type Locale } from '@/domains/_types';
import styles from '@/app/page.module.css';
import { Icon }   from '@/components/ui/Icon';
import { iconOf } from '@/domains/_categories';

/**
 * ONE ecosystem card, rendered by the landing page and by /demo.
 *
 * Both surfaces previously repeated the same JSX against the same CSS module,
 * so a card change had to be made twice or the two silently diverged. This is
 * the same rule the assistant's menu is built on: one component, every surface.
 *
 * The icon is the registry emoji — the same glyph the signed-in Hub shows, so a
 * visitor recognises the app after logging in. It sits in a fixed tile tinted
 * with the group colour: emoji have wildly different widths, heights and
 * baselines, and left loose they make a grid look pasted together rather than
 * designed. The tile is what gives 23 different glyphs one visual weight.
 */
export function AppCard({
  app, locale, index, onOpen,
}: {
  app:    EcosystemApp;
  locale: Locale;
  index:  number;
  onOpen: (app: EcosystemApp) => void;
}) {
  const color = app.accent;
  const meta  = app.category ? categoryMeta(app.category) : undefined;
  const rtl   = locale === 'ar';

  return (
    <div
      className={styles.appCard}
      style={{ animationDelay: `${Math.min(index, 12) * 0.04}s`, '--cat-color': color } as React.CSSProperties}
      onClick={() => onOpen(app)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(app); }
      }}
      role="button"
      tabIndex={0}
      aria-label={t(app.name, locale)}
    >
      <div className={styles.appCardGlow} />

      <div className={styles.appCardTop}>
        <span className={styles.appIconTile} aria-hidden>
          <Icon name={iconOf(app.slug)} size={28} color="var(--cat-color, #F8B820)" strokeWidth={1.8} />
        </span>
        {app.live && (
          <span className={styles.appLive}>
            <i className={styles.appLiveDot} />LIVE
          </span>
        )}
      </div>

      <span className={styles.appName} dir="auto">{t(app.name, locale)}</span>
      <span className={styles.appDesc} dir="auto">{t(app.blurb, locale)}</span>

      <div className={styles.appFooter}>
        <span className={styles.appCategory}>{meta ? t(meta.label, locale) : (rtl ? 'أخرى' : 'More')}</span>
        <span className={styles.appArrow}>{rtl ? '←' : '→'}</span>
      </div>
    </div>
  );
}
