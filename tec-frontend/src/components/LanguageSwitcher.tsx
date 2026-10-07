'use client';

import { useTranslation, LOCALES, type Locale } from '@/lib/i18n';
import styles from './LanguageSwitcher.module.css';

/**
 * The language picker — twelve languages, each named in ITSELF (中文, not
 * "Chinese"), so a person who cannot read the current interface can still find
 * their own language in the list.
 *
 * It was a two-way toggle (English ⇄ العربية) until 2026-10-07, when a Pioneer
 * asked the assistant five times for Chinese. A native <select> rather than a
 * custom menu: it opens the phone's own picker, which works the same in Pi
 * Browser and every other browser and needs no focus management of ours.
 *
 * `compact` keeps the header's fixed 36px square: the visible face is the short
 * code (EN, ع, 中…) and the select itself sits invisibly on top of it.
 */
const SHORT: Record<Locale, string> = {
  en: 'EN', ar: 'ع', zh: '中', vi: 'VI', ko: '한', id: 'ID',
  hi: 'हि', es: 'ES', pt: 'PT', fr: 'FR', tr: 'TR', ru: 'RU',
};

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useTranslation();
  const label = t.dashboard.menu.language;

  const select = (
    <select
      aria-label={label}
      title={label}
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className={compact ? styles.overlay : `${styles.switcher} ${styles.select}`}
      data-testid="language-select"
    >
      {LOCALES.map((l) => (
        <option key={l.code} value={l.code} lang={l.code} dir={l.dir}>{l.native}</option>
      ))}
    </select>
  );

  if (!compact) return select;

  return (
    <span className={`${styles.switcher} ${styles.compact} ${styles.wrap}`}>
      <span aria-hidden>{SHORT[locale]}</span>
      {select}
    </span>
  );
}
