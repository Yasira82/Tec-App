'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { en } from './en';
import { ar } from './ar';

type Locale = 'en' | 'ar';
export type Translations = typeof en;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
  dir: 'ltr' | 'rtl';
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

const translations = { en, ar };

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    // Load saved locale from localStorage
    const saved = localStorage.getItem('tec_locale') as Locale;
    if (saved && (saved === 'en' || saved === 'ar')) {
      setLocaleState(saved);
    } else if (saved) {
      // Invalid locale value, clear it and use default
      console.warn(`Invalid locale "${saved}" found in localStorage. Using default locale "en".`);
      localStorage.removeItem('tec_locale');
    }
  }, []);

  const dir: 'ltr' | 'rtl' = locale === 'ar' ? 'rtl' : 'ltr';

  // The root layout ships `<html lang="en" dir="ltr">` — it is static HTML, so it
  // cannot know the reader's choice. Without this the DOCUMENT stayed LTR while the
  // app shell inside it was RTL: the scrollbar sat on the wrong side, and anything
  // rendered outside the shell (portals, the browser's own text selection) followed
  // the wrong direction. Announcing `lang` matters too — a screen reader given
  // `lang="en"` reads Arabic with English phonetics.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir  = dir;
  }, [locale, dir]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('tec_locale', newLocale);
  };

  const contextValue: LocaleContextValue = {
    locale,
    setLocale,
    t: translations[locale],
    dir,
  };

  return <LocaleContext.Provider value={contextValue}>{children}</LocaleContext.Provider>;
}

/**
 * Fill `{name}` placeholders in a dictionary string.
 *
 * Counts and durations belong IN the sentence, not concatenated around it —
 * Arabic and English place the number differently, and a hand-built
 * `` `${n} unread` `` cannot be translated at all. An unknown placeholder is
 * left visible on purpose: a literal `{days}` on screen is a missing variable,
 * which is easier to spot than a silently empty gap.
 */
export const fill = (s: string, vars: Record<string, string | number>): string =>
  s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

export function useTranslation() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useTranslation must be used within LocaleProvider');
  }
  return context;
}
