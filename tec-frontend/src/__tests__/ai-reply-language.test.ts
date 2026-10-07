/**
 * The assistant answers in the language it is spoken to — and the asks that
 * matched nothing now have words (owner's /hub/admin/life-ai, 2026-10-07).
 *
 * The first real reading: 25 messages, 24 matched no objective, and the largest
 * group was people asking for their own language — "بالعربي", "انتا كل مره لازم
 * اقولك تكتب بالعربي", "转中文", "全是英文看不懂". The route rendered "Language
 * preference: English" from the INTERFACE language and the model obeyed it.
 *
 * The real asks from that reading are the fixture below: each must now land on an
 * objective, except the one that genuinely says nothing classifiable ("没找到").
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectScriptLocale, resolveReplyLanguage, replyLanguageLine } from '@/lib/ai/reply-language';
import { observeIntent, OBJECTIVES } from '@/lib/ai/intent-observation';
import { LOCALES, LOCALE_CODES, isLocaleCode } from '@/lib/locales';
import { en } from '@/lib/i18n/en';
import { ar } from '@/lib/i18n/ar';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('detectScriptLocale — only where the script alone is unambiguous', () => {
  it.each([
    ['بالعربي', 'ar'],
    ['انتا كل مره لازم اقولك تكتب بالعربي', 'ar'],
    ['用户界面切换成中文就好了，全是英文看不懂', 'zh'],
    ['转中文', 'zh'],
    ['한국어로 대답해 주세요', 'ko'],
    ['मुझे हिंदी में बताओ', 'hi'],
    ['объясни на русском', 'ru'],
    ['Ứng dụng này làm gì?', 'vi'],
    ['ايه هو تطبيق life', 'ar'],                // Arabic with a Latin app name is Arabic
  ])('%s → %s', (text, code) => expect(detectScriptLocale(text)).toBe(code));

  it.each(['What is TEC?', '¿Qué es TEC?', 'Apa itu TEC?', 'TEC nedir?', '', '   ', '42', '🙂'])(
    'Latin, digits or nothing → null (mirrored by the model, not guessed by a regex): %j',
    (text) => expect(detectScriptLocale(text)).toBeNull(),
  );
});

describe('resolveReplyLanguage — the setting, then the message, then mirror', () => {
  it('an explicit setting wins over the message', () => {
    expect(resolveReplyLanguage({ setting: 'fr', lastMessage: 'بالعربي', ui: 'en' })).toEqual({ code: 'fr', source: 'setting' });
  });

  it('THE BUG: an Arabic message in an English interface is answered in Arabic', () => {
    expect(resolveReplyLanguage({ setting: 'auto', lastMessage: 'مش قولنا بالعربي انتا في عندك مشكله', ui: 'en' }))
      .toEqual({ code: 'ar', source: 'message' });
  });

  it('a Chinese message gets Chinese — the interface does not have to speak it', () => {
    expect(resolveReplyLanguage({ lastMessage: '只有英文，转换不到中文', ui: 'en' })).toEqual({ code: 'zh', source: 'message' });
  });

  it('a Latin-script message is mirrored, with the interface as the tiebreak only', () => {
    expect(resolveReplyLanguage({ lastMessage: '¿Qué es Nexus?', ui: 'es' })).toEqual({ code: null, source: 'mirror', fallback: 'es' });
    expect(resolveReplyLanguage({ lastMessage: 'hi', ui: 'xx' })).toEqual({ code: null, source: 'mirror', fallback: null });
  });

  it('"auto", garbage and unknown codes are no setting', () => {
    for (const s of ['auto', 'xx', 7, null, undefined, 'EN']) {
      expect(resolveReplyLanguage({ setting: s, lastMessage: 'بالعربي' }).source).toBe('message');
    }
  });

  it('the prompt line names the language and says the interface does not decide', () => {
    expect(replyLanguageLine({ code: 'ar', source: 'message' })).toMatch(/Arabic — the language of the user's last message.*whatever the interface language is/);
    expect(replyLanguageLine({ code: 'zh', source: 'setting' })).toMatch(/Chinese\. The user CHOSE it/);
    expect(replyLanguageLine({ code: null, source: 'mirror', fallback: 'en' })).toMatch(/mirror it exactly.*Only if their message gives no clue, use English/);
  });
});

describe('the route and the clients', () => {
  const route  = read('src/app/api/ai/chat/route.ts');
  const prompt = read('src/lib/ai/tec-ai-system-prompt.ts');

  it('no "Language preference" line from the interface any more; the resolved reply line instead', () => {
    expect(route).not.toContain('Language preference');
    expect(route).toContain('replyLanguageLine(userContext.replyLanguage)');
    expect(route).toMatch(/resolveReplyLanguage\(\{ setting: raw\.replyLocale, lastMessage: lastUserText, ui: uiLocale \}\)/);
  });

  it('the route accepts any of the twelve locales — not only en/ar', () => {
    expect(route).toMatch(/oneOf\(raw\.locale, LOCALE_CODES\)/);
    expect(route).not.toMatch(/oneOf\(raw\.locale,\s*\['en', 'ar'\]/);
  });

  it('the prompt says any language, and that an English interface is never a reason for English', () => {
    expect(prompt).toMatch(/ALWAYS reply in the language of the user's LAST message — any language/);
    expect(prompt).toMatch(/NEVER a reason to answer in English/);
    expect(prompt).not.toMatch(/\(Arabic or English\)\./);
  });

  it('both clients send the interface language and the reply choice as two fields', () => {
    for (const p of ['src/app/ai/AiClient.tsx', 'src/lib-client/hooks/useAiChat.ts']) {
      const src = read(p);
      expect(src, p).toMatch(/replyLocale: settings\.replyLocale/);
      expect(src, p).not.toMatch(/settings\.replyLocale !== 'auto'\s*\?/);
    }
    // The hook used to send 'ar' for every interface that was not English.
    expect(read('src/lib-client/hooks/useAiChat.ts')).not.toMatch(/=== 'en' \? 'en' : 'ar'/);
  });

  it('the settings accept any of the twelve, and nothing else', () => {
    const session = read('src/lib/ai-session.ts');
    expect(session).toMatch(/replyLocale: isLocaleCode\(p\.replyLocale\) \? p\.replyLocale : 'auto'/);
  });

  it('the locale list is the fleet\'s twelve, each with an English name for the prompt', () => {
    expect(LOCALE_CODES).toEqual(['en', 'ar', 'zh', 'vi', 'ko', 'id', 'hi', 'es', 'pt', 'fr', 'tr', 'ru']);
    for (const l of LOCALES) expect(l.english).toBeTruthy();
    expect(isLocaleCode('zh')).toBe(true);
    expect(isLocaleCode('de')).toBe(false);
  });
});

describe('the asks that matched nothing now have words', () => {
  const REAL: [string, string | null][] = [
    ['بالعربي', 'change_language'],
    ['انتا كل مره لازم اقولك تكتب بالعربي', 'change_language'],
    ['مش قولنا بالعربي انتا في عندك مشكله', 'change_language'],
    ['ترجم الي الاجابة', 'change_language'],
    ['转中文', 'change_language'],
    ['只有英文，转换不到中文', 'change_language'],
    ['用户界面切换成中文就好了，全是英文看不懂', 'change_language'],
    ['切换成中文', 'change_language'],
    ['وانتا شايف ان مشروع tec ده هينجح ولا تضييع وقت', 'platform_trust'],
    ['وايه الفرق بينو وبين Dx', 'compare_apps'],
    ['يعتبر زي ال app studio ؟', 'compare_apps'],
    ['وانتا شايف اكتر تطبيق فيهم يكون مميز ايه', 'recommend_app'],
    ['وايه اكتر تطبيق احث من خلاله انو تطبيق مش تقليدي وقدر استفيد منه ويكون مش زي باقي تطبيقات pi عموماتا', 'recommend_app'],
    ['ايه هو تطبيق Nexus', 'explain_app'],
    ['ايه هو تطبيق life', 'explain_app'],
    ['و تطبيق Dx', 'explain_app'],
    ['و تطبيق Nx', 'explain_app'],
    ['اشرحلي Epic بالتفصيل', 'explain_app'],
    ['يعني ايه عقارات رقمية واشرحلي اكتر عن التطبيق', 'explain_app'],
    ['ايه تاني غير Estate', 'explain_app'],
    // "Not found" — no object, no app, no request. A null here is the instrument
    // being honest, not failing.
    ['没找到', null],
  ];

  it.each(REAL)('%s → %s', async (ask, objective) => {
    const o = await observeIntent(ask);
    expect(o?.objective ?? null).toBe(objective);
  });

  it('the five are in the closed set, after the fifteen that were there', () => {
    expect(OBJECTIVES.slice(-5)).toEqual(['change_language', 'platform_trust', 'compare_apps', 'recommend_app', 'explain_app']);
    expect(OBJECTIVES).toContain('understand_platform');
  });

  it('existing asks keep their objective', async () => {
    expect((await observeIntent('what is tec'))?.objective).toBe('understand_platform');
    expect((await observeIntent('send 50 pi to my friend'))?.objective).toBe('send_pi');
    expect((await observeIntent('I want to buy a phone'))?.objective).toBe('find_product');
  });
});

describe('the admin card names the Budget category', () => {
  it('in both languages', () => {
    expect(en.hub.adminLifeAi.categories.BUDGET).toBe('Budget');
    expect(ar.hub.adminLifeAi.categories.BUDGET).toBeTruthy();
  });
});
