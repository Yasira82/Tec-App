/**
 * The languages TEC speaks — ONE list, shared by the interface (lib/i18n), the
 * assistant's reply language (lib/ai/reply-language.ts) and its settings menu.
 *
 * The same twelve as the fleet's template apps (Life, Connection, …), chosen from
 * where Pi Network's communities actually are, not from a generic "top languages"
 * table: Chinese, Vietnamese, Korean and Indonesian are among the largest Pioneer
 * populations. The first real reading of the assistant (2026-10-07) had a Pioneer
 * ask five times, in Chinese, for Chinese — and get English every time.
 *
 * Adding a locale is one entry here + one dictionary file.
 */
export const LOCALES = [
  { code: 'en', native: 'English',    english: 'English',    dir: 'ltr', bcp47: 'en-US' },
  { code: 'ar', native: 'العربية',     english: 'Arabic',     dir: 'rtl', bcp47: 'ar-EG' },
  { code: 'zh', native: '中文',        english: 'Chinese',    dir: 'ltr', bcp47: 'zh-CN' },
  { code: 'vi', native: 'Tiếng Việt', english: 'Vietnamese', dir: 'ltr', bcp47: 'vi-VN' },
  { code: 'ko', native: '한국어',       english: 'Korean',     dir: 'ltr', bcp47: 'ko-KR' },
  { code: 'id', native: 'Indonesia',  english: 'Indonesian', dir: 'ltr', bcp47: 'id-ID' },
  { code: 'hi', native: 'हिन्दी',       english: 'Hindi',      dir: 'ltr', bcp47: 'hi-IN' },
  { code: 'es', native: 'Español',    english: 'Spanish',    dir: 'ltr', bcp47: 'es-ES' },
  { code: 'pt', native: 'Português',  english: 'Portuguese', dir: 'ltr', bcp47: 'pt-BR' },
  { code: 'fr', native: 'Français',   english: 'French',     dir: 'ltr', bcp47: 'fr-FR' },
  { code: 'tr', native: 'Türkçe',     english: 'Turkish',    dir: 'ltr', bcp47: 'tr-TR' },
  { code: 'ru', native: 'Русский',    english: 'Russian',    dir: 'ltr', bcp47: 'ru-RU' },
] as const;

export type LocaleCode = (typeof LOCALES)[number]['code'];

export const LOCALE_CODES: readonly LocaleCode[] = LOCALES.map((l) => l.code);

export const isLocaleCode = (v: unknown): v is LocaleCode =>
  typeof v === 'string' && (LOCALE_CODES as readonly string[]).includes(v);

export const localeInfo = (code: LocaleCode) => LOCALES.find((l) => l.code === code) ?? LOCALES[0];
