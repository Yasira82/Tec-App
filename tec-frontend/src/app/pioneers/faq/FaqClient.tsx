'use client';

// Pioneer FAQ + Trust page — reduces onboarding friction and builds trust before a
// Pi user logs in. Public (not in middleware PROTECTED_ROUTES). Bilingual EN/AR via
// the Hub i18n locale + dir. The app count is derived from the LIVE domain registry
// (single source of truth), never hard-coded. Inline styles only (Pi Browser safe).
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { LIVE_DOMAINS } from '@/domains/_registry';

const C = {
  bg: '#050816', surface: '#0B1020', surface2: '#111627',
  gold: 'var(--tec-gold)', text: '#E5E7EB', subtext: '#94A3B8', green: '#22C55E', purple: '#8B5CF6',
};

type QA = { q: string; a: string };
type Copy = {
  eyebrow: string; h1: string; lead: string;
  qa: (total: number) => QA[];
  back: string; cta: string; trustTitle: string; trust: string[];
};

const COPY: Record<'en' | 'ar', Copy> = {
  en: {
    eyebrow: 'Pioneers · Questions & Trust',
    h1: 'Pioneer FAQ',
    lead: 'Everything a new Pi user asks before joining TEC — answered honestly.',
    qa: (total) => [
      { q: 'What is TEC?', a: `A full economy built on Pi — ${total} apps sharing one identity and one wallet, with real Pi payments. Not a single app: a whole ecosystem (commerce, assets, reputation, business, and more).` },
      { q: 'What is a Founding Pioneer?', a: `The first 100 Pioneers to complete the Quest — opening every live app while logged in — earn a permanent Founding Pioneer badge in their TEC reputation. It is earned, never bought, and it is yours forever. Each one also receives 6 months of TEC PRO across the ecosystem — a 6-month period, which then ends; there is no auto-renewal and nothing to cancel.` },
      { q: 'Why do I log in with Pi?', a: 'One sign-in carries across all TEC apps (single sign-on). You authenticate with Pi itself — TEC never sees your Pi password or wallet keys. Your identity is simply your Pi username.' },
      { q: 'Is it safe? What data do you store?', a: 'Your session lives in secure HttpOnly cookies — never in localStorage, never exposed to scripts. TEC does not store your Pi wallet keys or your Pi-Network KYC. We keep only what an app needs to work, and every app states what it does.' },
      { q: 'Do I have to pay anything?', a: 'No. The Founding badge is earned by completing the Quest — opening every live app — with no payment required. Some apps offer optional Pi purchases later, and those always happen with your explicit approval.' },
      { q: 'Do I need KYC?', a: 'Pi Network handles KYC itself — for your wallet, for payments, and for domain claims. You do not complete a separate TEC KYC to be a Pioneer. Browsing is open to everyone; logging in starts your Quest.' },
      { q: 'How do I complete the Quest?', a: `Open each of the ${total} live apps in Pi Browser, log in once with Pi, and try one real action in each. Your progress is tracked on your own device as you go.` },
      { q: 'What if I am not one of the first 100?', a: 'You are still a Pioneer. Every action you take counts toward your TEC reputation, and more recognition tiers (Explorer, Builder) reward early and active members beyond the Founding 100.' },
      { q: 'Are the numbers real?', a: 'Always. TEC never shows a fabricated counter — if zero Pioneers have joined, it shows zero. Every number you see is real server data. Credibility with the Pi community is the whole point.' },
    ],
    back: '← Back to Pioneers',
    cta: 'Start your Pioneer Quest',
    trustTitle: 'Our promises to you',
    trust: [
      'Real numbers only — never a fabricated stat.',
      'Your Pi login is yours — we never see your password or keys.',
      'No hidden charges — the Founding badge is earned, not paid for.',
      'Every app delivers real value — no empty pages.',
    ],
  },
  ar: {
    eyebrow: 'Pioneers · أسئلة وثقة',
    h1: 'أسئلة الـ Pioneers الشائعة',
    lead: 'كل اللي أي مستخدم Pi جديد بيسأله قبل ما ينضم لـ TEC — بإجابات صادقة.',
    qa: (total) => [
      { q: 'إيه هي TEC؟', a: `اقتصاد كامل مبني على Pi — ${total} تطبيق بيشاركوا هوية واحدة ومحفظة واحدة، بمدفوعات Pi حقيقية. مش تطبيق واحد: منظومة كاملة (تجارة، أصول، سمعة، أعمال، وأكتر).` },
      { q: 'مين هو الـ Founding Pioneer؟', a: 'أول 100 Pioneer يكمّلوا الـ Quest — يفتحوا كل التطبيقات الشغّالة وهما مسجّلين دخول — بياخدوا شارة Founding Pioneer دائمة في سمعتهم داخل TEC. بتتكسب، متتشريش، وليك للأبد. وكل واحد فيهم بياخد كمان ٦ شهور TEC PRO في المنظومة كلها — مدة ٦ شهور وبعدها تنتهي؛ مفيش تجديد تلقائي ولا حاجة تلغيها.' },
      { q: 'ليه أسجّل دخول بـ Pi؟', a: 'تسجيل دخول واحد بيمشي معاك في كل تطبيقات TEC (دخول موحّد). إنت بتتحقق من Pi نفسه — TEC عمرها ما بتشوف باسورد Pi أو مفاتيح محفظتك. هويتك ببساطة هي اسم مستخدم Pi بتاعك.' },
      { q: 'هل آمن؟ وإيه اللي بتخزّنوه؟', a: 'جلستك بتعيش في كوكيز HttpOnly آمنة — مش في localStorage، ومش متاحة لأي سكربت. TEC مبتخزّنش مفاتيح محفظة Pi ولا KYC بتاع Pi Network. بنحتفظ بس باللي التطبيق محتاجه عشان يشتغل، وكل تطبيق بيوضّح بيعمل إيه.' },
      { q: 'هل لازم أدفع؟', a: 'لأ. شارة Founding بتتكسب بإكمال الـ Quest — فتح كل التطبيقات الشغّالة — من غير أي دفع. بعض التطبيقات بتوفّر مشتريات Pi اختيارية بعدين، وديماً بتحصل بموافقتك الصريحة.' },
      { q: 'هل محتاج KYC؟', a: 'Pi Network هو اللي بيتكفّل بالـ KYC — لمحفظتك، للمدفوعات، ولاستلام الدومينات. مش بتعمل KYC منفصل لـ TEC عشان تبقى Pioneer. التصفّح متاح للجميع؛ تسجيل الدخول بيبدأ مهمّتك.' },
      { q: 'إزاي أكمّل الـ Quest؟', a: `افتح كل واحد من الـ ${total} تطبيق في متصفح Pi، سجّل دخول مرة بـ Pi، وجرّب إجراء حقيقي واحد في كل تطبيق. تقدّمك بيتسجّل على جهازك وإنت بتمشي.` },
      { q: 'ولو مش من أول 100؟', a: 'برضه إنت Pioneer. كل إجراء بتعمله بيتحسب في سمعتك داخل TEC، وفيه طبقات تقدير تانية (مستكشف، باني) بتكافئ الأعضاء المبكرين والنشطين بعد الـ Founding 100.' },
      { q: 'هل الأرقام حقيقية؟', a: 'ديماً. TEC عمرها ما بتعرض رقم مزيّف — لو مفيش Pioneers انضمّوا، بتعرض صفر. كل رقم بتشوفه بيانات سيرفر حقيقية. مصداقيّتنا مع مجتمع Pi هي الأصل.' },
    ],
    back: '→ رجوع لصفحة الـ Pioneers',
    cta: 'ابدأ مهمّتك كـ Pioneer',
    trustTitle: 'وعودنا ليك',
    trust: [
      'أرقام حقيقية بس — عمرنا ما نعرض إحصائية مزيّفة.',
      'تسجيل دخول Pi بتاعك ملكك — عمرنا ما نشوف الباسورد أو المفاتيح.',
      'مافيش رسوم مخفية — شارة Founding بتتكسب، متتدفعش.',
      'كل تطبيق بيقدّم قيمة حقيقية — مافيش صفحات فاضية.',
    ],
  },
};

export default function FaqClient() {
  const { locale, dir } = useTranslation();
  const t = COPY[locale];
  const total = LIVE_DOMAINS.length;
  const qa = t.qa(total);

  const card: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.gold}22`, borderRadius: 16, padding: 18,
  };

  return (
    <main dir={dir} style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '28px 18px 64px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <Link href="/pioneers" style={{ color: C.gold, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>{t.back}</Link>
          <LanguageSwitcher />
        </div>

        <div style={{ fontSize: 12, fontWeight: 800, color: C.gold, letterSpacing: 1, textTransform: 'uppercase' }}>{t.eyebrow}</div>
        <h1 style={{ fontSize: 30, fontWeight: 900, margin: '10px 0 8px', color: C.text }}>{t.h1}</h1>
        <p style={{ fontSize: 14.5, color: C.subtext, margin: 0, lineHeight: 1.7 }}>{t.lead}</p>

        <div style={{ display: 'grid', gap: 12, marginTop: 26 }}>
          {qa.map((item, i) => (
            <section key={i} style={card}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.gold }}>{item.q}</div>
              <p style={{ fontSize: 13.5, color: C.text, margin: '8px 0 0', lineHeight: 1.75 }}>{item.a}</p>
            </section>
          ))}
        </div>

        {/* Trust promises */}
        <section style={{ ...card, marginTop: 24, background: `${C.green}10`, borderColor: `${C.green}44` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.green }}>✓ {t.trustTitle}</div>
          <ul style={{ margin: '10px 0 0', paddingInlineStart: 20, display: 'grid', gap: 6 }}>
            {t.trust.map((line, i) => (
              <li key={i} style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{line}</li>
            ))}
          </ul>
        </section>

        <Link
          href="/pioneers"
          style={{
            display: 'block', textAlign: 'center', marginTop: 26, padding: '14px 20px',
            background: `linear-gradient(135deg, ${C.gold}, var(--tec-gold-dark))`, color: '#1a1205',
            borderRadius: 12, fontWeight: 900, fontSize: 15, textDecoration: 'none',
          }}
        >
          {t.cta} →
        </Link>
      </div>
    </main>
  );
}
