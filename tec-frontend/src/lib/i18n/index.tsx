'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { LOCALES, isLocaleCode, localeInfo, type LocaleCode } from '@/lib/locales';
import { en } from './en';
import { ar } from './ar';
import { zh } from './zh';
import { vi } from './vi';
import { ko } from './ko';
import { id } from './id';
import { hi } from './hi';
import { es } from './es';
import { pt } from './pt';
import { fr } from './fr';
import { tr } from './tr';
import { ru } from './ru';

/**
 * The Hub's twelve languages — the fleet's list (lib/locales.ts), the same as
 * Life, Connection and the other template apps.
 *
 * Until 2026-10-07 the Hub spoke English and Arabic only. The first real reading
 * of the assistant had a Pioneer ask five times, in Chinese, for Chinese
 * ("全是英文看不懂" — "it is all English, I can't read it"). Every dictionary below
 * is COMPLETE: typed as `Translations` and pinned key-for-key by
 * `i18n-parity.test.ts`, so a key added in English cannot ship untranslated.
 *
 * App NAMES stay English on purpose (the domain registry): the .pi domains and
 * the Pi Portal listings are registered in English. The registry's descriptions
 * exist in English and Arabic; other languages read the English one until the
 * registry carries them.
 */
export type Locale = LocaleCode;
export type Translations = typeof en;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
  dir: 'ltr' | 'rtl';
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

/** Every dictionary, keyed by locale. Exported for components that are handed a locale rather than reading the context. */
export const DICTIONARIES: Record<Locale, Translations> = { en, ar, zh, vi, ko, id, hi, es, pt, fr, tr, ru };

const STORAGE_KEY = 'tec_locale';

/**
 * A first visit with nothing saved follows the browser: `zh-CN` → `zh`, `pt-BR` →
 * `pt`. A Chinese phone no longer opens on English and has to hunt for a switch.
 * Anything not in the twelve falls back to English.
 */
export function pickFromBrowser(langs: readonly string[] | undefined): Locale {
  for (const l of langs ?? []) {
    const base = (l ?? '').toLowerCase().split('-')[0];
    if (isLocaleCode(base)) return base;
  }
  return 'en';
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* private mode */ }
    if (isLocaleCode(saved)) {
      setLocaleState(saved);
      return;
    }
    if (saved) {
      console.warn(`Invalid locale "${saved}" found in localStorage. Using the browser language.`);
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
    if (typeof navigator !== 'undefined') {
      setLocaleState(pickFromBrowser(navigator.languages?.length ? navigator.languages : [navigator.language]));
    }
  }, []);

  const dir: 'ltr' | 'rtl' = localeInfo(locale).dir;

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir  = dir;
  }, [locale, dir]);

  const setLocale = (newLocale: Locale) => {
    if (!isLocaleCode(newLocale)) return;
    setLocaleState(newLocale);
    try { localStorage.setItem(STORAGE_KEY, newLocale); } catch { /* ignore */ }
  };

  const contextValue: LocaleContextValue = {
    locale,
    setLocale,
    t: DICTIONARIES[locale],
    dir,
  };

  return <LocaleContext.Provider value={contextValue}>{children}</LocaleContext.Provider>;
}

export { LOCALES };

export const bcp47 = (locale: Locale): string => localeInfo(locale).bcp47;

export const errorText = (t: Translations, err: string): string =>
  err === 'NOT_AUTHENTICATED' ? t.common.notAuthenticated : err;

export const fill = (s: string, vars: Record<string, string | number>): string =>
  s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

export function useTranslation() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useTranslation must be used within LocaleProvider');
  }
  return context;
}
