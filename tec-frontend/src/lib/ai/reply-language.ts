/**
 * Which language the assistant answers in.
 *
 * The first real reading of the assistant (2026-10-07, /hub/admin/life-ai) was a
 * list of people asking for their own language: "بالعربي", "انتا كل مره لازم اقولك
 * تكتب بالعربي", "转中文", "全是英文看不懂". The prompt said "reply in the user's
 * language", but the route ALSO rendered "Language preference: English" — taken
 * from the INTERFACE language, not from what the person wrote — and the model
 * obeyed the explicit line. An Arabic question in an English interface got
 * English; a Chinese question could never get Chinese (only en/ar were accepted).
 *
 * The order now:
 *   1. the person's explicit choice in the assistant's settings — they asked;
 *   2. the script of their LAST message, when the script alone is unambiguous
 *      (Arabic, Chinese, Korean, Hindi, Russian, Vietnamese diacritics);
 *   3. otherwise mirror the message — Latin script is shared by English, Spanish,
 *      French, Portuguese, Indonesian and Turkish, and guessing between them is
 *      the model's job, not a regex's — with the interface language as the
 *      tiebreak ONLY when the message itself is unclear.
 *
 * Pure: no I/O.
 */
import { isLocaleCode, localeInfo, type LocaleCode } from '@/lib/locales';

const SCRIPTS: [LocaleCode, RegExp][] = [
  ['ar', /[؀-ۿݐ-ݿࢠ-ࣿ]/],
  ['ko', /[가-힯ᄀ-ᇿ]/],       // Hangul before Han: Korean text can carry Hanja
  ['zh', /[一-鿿㐀-䶿]/],
  ['hi', /[ऀ-ॿ]/],
  ['ru', /[Ѐ-ӿ]/],
  // Letters that exist in Vietnamese and in none of the other Latin-script locales.
  ['vi', /[ơưđăạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i],
];

/** The locale a message's script names unambiguously — or null (Latin, digits, emoji, empty). */
export function detectScriptLocale(text: string | undefined | null): LocaleCode | null {
  const s = (text ?? '').trim();
  if (!s) return null;
  for (const [code, rx] of SCRIPTS) if (rx.test(s)) return code;
  return null;
}

export type ReplyLanguage =
  | { code: LocaleCode; source: 'setting' | 'message' }
  | { code: null; source: 'mirror'; fallback: LocaleCode | null };

export function resolveReplyLanguage(input: {
  /** The explicit choice from the assistant's settings; anything not a known locale (incl. 'auto') is no choice. */
  setting?: unknown;
  /** The person's last message. */
  lastMessage?: string | null;
  /** The interface language — a tiebreak, never a reason to switch language. */
  ui?: unknown;
}): ReplyLanguage {
  if (isLocaleCode(input.setting)) return { code: input.setting, source: 'setting' };
  const fromScript = detectScriptLocale(input.lastMessage);
  if (fromScript) return { code: fromScript, source: 'message' };
  return { code: null, source: 'mirror', fallback: isLocaleCode(input.ui) ? input.ui : null };
}

/** The one line the prompt carries about language — explicit, so nothing else can override it. */
export function replyLanguageLine(r: ReplyLanguage): string {
  if (r.code !== null) {
    const name = localeInfo(r.code).english;
    return r.source === 'setting'
      ? `- Reply language: ${name}. The user CHOSE it in the assistant's settings — answer in ${name} even when they write in another language.`
      : `- Reply language: ${name} — the language of the user's last message. Answer in ${name}, whatever the interface language is.`;
  }
  const tie = r.fallback ? ` Only if their message gives no clue, use ${localeInfo(r.fallback).english}.` : '';
  return `- Reply language: the language of the user's LAST message — mirror it exactly (Spanish → Spanish, Indonesian → Indonesian, English → English).${tie}`;
}
