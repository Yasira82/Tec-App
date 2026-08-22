'use client';

import { useTranslation } from '@/lib/i18n';
import styles from './LanguageSwitcher.module.css';

/**
 * `compact` shows the two-letter code instead of the language's full name.
 *
 * The Hub header carries a logo, a clock, this control, a bell and the account
 * chip. At 390px the full word "English" was the straw that broke it: the row
 * overflowed and pushed the account chip off the screen edge, leaving the page
 * with a horizontal scrollbar. A switcher wide enough to break the header it
 * sits in is not worth the extra letters.
 */
export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useTranslation();
  const next = locale === 'en' ? 'ar' : 'en';

  return (
    <button
      className={compact ? `${styles.switcher} ${styles.compact}` : styles.switcher}
      onClick={() => setLocale(next)}
      // The label names the DESTINATION, not the current language — the button
      // switches, it does not report.
      aria-label={next === 'ar' ? 'التبديل إلى العربية' : 'Switch to English'}
      title={next === 'ar' ? 'العربية' : 'English'}
    >
      {compact
        ? (next === 'ar' ? 'ع' : 'EN')
        : (next === 'ar' ? 'العربية' : 'English')}
    </button>
  );
}
