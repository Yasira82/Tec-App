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

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('tec_locale', newLocale);
  };

  const contextValue: LocaleContextValue = {
    locale,
    setLocale,
    t: translations[locale],
    dir: locale === 'ar' ? 'rtl' : 'ltr',
  };

  return <LocaleContext.Provider value={contextValue}>{children}</LocaleContext.Provider>;
}

export function useTranslation() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useTranslation must be used within LocaleProvider');
  }
  return context;
}
