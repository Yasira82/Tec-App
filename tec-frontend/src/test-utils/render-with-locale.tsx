/**
 * `render` for anything that reads the interface language.
 *
 * The Hub now calls `useTranslation()`, which throws outside `LocaleProvider` — a
 * deliberate guard, since a component silently falling back to English is exactly
 * how a half-translated screen ships. Production is fine (the provider wraps the
 * whole app in the root layout); tests have to supply it.
 *
 * It wraps the REAL provider rather than mocking `@/lib/i18n`. A mocked dictionary
 * would let a missing or misspelled key pass — the test would be checking the mock,
 * not the translation.
 *
 * Default locale is `en`, matching a first visit. Pass `locale: 'ar'` to assert the
 * Arabic rendering, including `dir`.
 */
import type { ReactElement, ReactNode } from 'react';
import { render as rtlRender, type RenderOptions } from '@testing-library/react';
import { LocaleProvider } from '@/lib/i18n';

export type Locale = 'en' | 'ar';

interface Options extends Omit<RenderOptions, 'wrapper'> {
  locale?: Locale;
}

export function render(ui: ReactElement, { locale = 'en', ...options }: Options = {}) {
  // LocaleProvider reads its initial value from localStorage on mount, so this is
  // how a test picks a language — the same path a real user takes via the switcher.
  try { window.localStorage.setItem('tec_locale', locale); } catch { /* ignore */ }

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <LocaleProvider>{children}</LocaleProvider>
  );
  return rtlRender(ui, { wrapper: Wrapper, ...options });
}

export * from '@testing-library/react';
