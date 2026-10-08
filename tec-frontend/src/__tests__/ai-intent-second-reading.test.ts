/**
 * The second reading of /hub/admin/life-ai (owner, 2026-10-08).
 *
 * After #293 no ask on 7 Oct asked for a language — that fix held. But every one of
 * the 7 Oct asks still matched nothing: Egyptian Arabic says the same thing with other
 * words ("ابدأ بمين" for "which app first", "موثقتش" for "not verified"), and two kinds
 * of question had no objective at all — what the assistant itself can see, and what is
 * new on the platform.
 *
 * The real asks are the fixture. The ones that stay `null` stay null on purpose: a
 * feature request ("there is no product analysis") or a complaint about an answer is
 * exactly what the unmatched list is for.
 */
import { describe, it, expect } from 'vitest';
import { observeIntent, OBJECTIVES } from '@/lib/ai/intent-observation';

const REAL: [string, string | null][] = [
  // About the assistant itself.
  ['يعني انتا تقدر تشوف أهدافي علي life', 'assistant_capability'],
  ['انا عندي أهداف علي Life', 'assistant_capability'],
  ['اشرح أكتر علاقة Tec Ai ب Life', 'assistant_capability'],
  ['مش فاهم انتا ايه العلاقة المشتركة ما بنكم ولا نتا بس بوت', 'assistant_capability'],
  // What is new.
  ['انتا تعرف ايه تحديثات Tec وعند خريطة طريق وهل ديه اخر الاحداثيات ؟', 'platform_news'],
  ['ياريت تحدث نفسك', 'platform_news'],
  // Candour about the platform.
  ['ايه اليي انتا شايفو صغره في المشروع وقول بكل صدق', 'platform_trust'],
  ['ايه أضعف خدمة', 'platform_trust'],
  ['انا مش شايف اي استفادة حقيقية منك', 'platform_trust'],
  ['يعني التطبيقات اليي موجودة في Tec أغلبيتهم بيخدمو Tec مش مجتمع باي', 'platform_trust'],
  ['انا مش فاهم التطبيقات وايه ده مش كده انتو بتحورو', 'platform_trust'],
  // Where to start.
  ['ابدأ بمين Epic nbf nx zone', 'recommend_app'],
  ['عاوز ابدأ ومش عاوز تطبيق تجارة', 'recommend_app'],
  ['ايه غير تطبيقات التجارة', 'recommend_app'],
  // Verification, conjugated.
  ['لازم أوثق في tec علاشان اخد محفظة', 'verify_identity'],
  ['بس انا عندي محفظة وما وثقتش', 'verify_identity'],
  ['بس انا بعرف ابدل بين التطبيقات بنقرة واحدة وعندي محفظة Tec و موثقتش', 'verify_identity'],
  // A product.
  ['طيب ما انا قولتلك عاوز شاحن جوده وسعر', 'find_product'],
  // What an app is for.
  ['ايه السفادة من Analytics', 'explain_app'],
  ['وايه اليي موجود في assets يكون مميز عن أي تطبيق زيو', 'explain_app'],
  ['يعني تطبيق Life عبارة عن أهداف بس لتطبيقات Tec', 'explain_app'],
  ['هو في life coaching في تطبيق life', 'explain_app'],
  ['يعني علي كلامك انا قادر اشوف المخزون والملكية عند بيع منتجات عبر commerce و ecommerce مرتبطة بحساب assetes', 'explain_app'],
  ['هي ايه الخدمات اليي مبني عليه المشروع', 'understand_platform'],
  // Null on purpose: a feature request and a complaint about an answer.
  ['ما فيش تحليل منتاجات', null],
  ['ولة عرضت علطول علي Commerce فيها مشكلة', null],
];

describe('the second reading: the 7 Oct asks', () => {
  it.each(REAL)('%s → %s', async (ask, objective) => {
    expect((await observeIntent(ask))?.objective ?? null).toBe(objective);
  });

  it('the two new objectives are in the closed set', () => {
    expect(OBJECTIVES).toContain('assistant_capability');
    expect(OBJECTIVES).toContain('platform_news');
  });
});

describe('a continuation takes the objective of the ask before it', () => {
  it.each(['وبعدين', 'اشرح اكتر', 'go on', 'tell me more'])('%s', async (ask) => {
    const o = await observeIntent(ask, { previous: 'ايه هو تطبيق Nexus' });
    expect(o?.objective).toBe('explain_app');
    expect(o?.ask).toBeUndefined();   // matched → no excerpt
  });

  it('stays null — with its excerpt — when the previous ask had none', async () => {
    const o = await observeIntent('وبعدين', { previous: 'ما فيش تحليل منتاجات' });
    expect(o?.objective).toBeNull();
    expect(o?.ask).toBe('وبعدين');
  });

  it('stays null without a previous ask', async () => {
    expect((await observeIntent('اشرح اكتر'))?.objective).toBeNull();
  });

  it('a real question is never treated as a continuation', async () => {
    const o = await observeIntent('ايه أضعف خدمة', { previous: 'ايه هو تطبيق Nexus' });
    expect(o?.objective).toBe('platform_trust');
  });
});

describe('a greeting alone is not observed', () => {
  it.each(['السلام عليكم ورحمة الله وبركاته', 'السلام عليكم', 'مرحبا', 'hello!'])('%s', async (ask) => {
    expect(await observeIntent(ask)).toBeNull();
  });

  it('a greeting followed by a question is', async () => {
    expect((await observeIntent('السلام عليكم، ايه أضعف خدمة'))?.objective).toBe('platform_trust');
  });
});
