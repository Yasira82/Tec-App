'use client';

// TEC Pioneers — onboarding shell. Reads the LIVE apps straight from the Hub domain
// registry (single source of truth — @/domains/_registry), so this page never drifts
// from what is actually live. Bilingual EN/AR via the Hub i18n locale + dir. Every app
// is a tappable link to its own domain, so a Pioneer opens it in Pi Browser (engagement
// is per-App-ID → each app must be opened at its own domain, not only navigated inside
// Hub). Inline styles only (Pi Browser safe — no CSS modules / Tailwind).
import { useTranslation } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { LIVE_DOMAINS } from '@/domains/_registry';

// TEC EVL tokens (C-83) — inlined so the page is self-contained in Pi Browser.
const C = {
  bg: '#050816', surface: '#0B1020', surface2: '#111627',
  gold: '#FBBF24', goldDark: '#F59E0B',
  text: '#E5E7EB', subtext: '#94A3B8', green: '#22C55E',
};

// The Pioneer opens each app at its OWN domain. The registry route is the source of
// truth: a full https URL → the app's domain; a relative path → a Hub-internal app
// (same origin, already inside Pi Browser). Fall back to the canonical web domain.
function linkFor(slug: string, route: string | null): string {
  if (route && route.startsWith('http')) return route;
  if (route && route.startsWith('/')) return route;
  return `https://${slug}.tecosystem.app`;
}

type Copy = {
  eyebrow: string; h1: string; lead: string;
  callout: string;
  stepsTitle: string;
  steps: { n: string; title: string; body: string }[];
  appsTitle: string; appsLead: string;
  footer: string;
};

const COPY: Record<'en' | 'ar', Copy> = {
  en: {
    eyebrow: 'TEC Ecosystem · Live on Pi Mainnet',
    h1: 'Be one of our first Pioneers',
    lead: 'TEC is a full economy on Pi — 24 apps, one identity, real Pi payments. Help us launch: open the apps below in Pi Browser and try them. Early Pioneers shape what comes next.',
    callout: 'Open this page inside Pi Browser, and make sure your Pi account is KYC-verified — that is what lets your visit count.',
    stepsTitle: 'How to be a Pioneer — 3 steps',
    steps: [
      { n: '1', title: 'Open in Pi Browser', body: 'Tap any app below from inside the Pi Browser app. It opens on its own Pi domain.' },
      { n: '2', title: 'Log in with Pi', body: 'Sign in once with your Pi account. Your session carries across all TEC apps (single sign-on).' },
      { n: '3', title: 'Try one action', body: 'Do one thing in each app — browse, create, or a small Pi payment. That small action is your Pioneer footprint.' },
    ],
    appsTitle: 'The 24 apps — all live',
    appsLead: 'Tap to open each one in Pi Browser. Start with Hub, then explore.',
    footer: 'Thank you for pioneering TEC. Every app you open and every Pi you spend helps a real Pi-native economy go live.',
  },
  ar: {
    eyebrow: 'منظومة TEC · شغّالة على Pi Mainnet',
    h1: 'كن من أوائل رُوّادنا',
    lead: 'TEC اقتصاد كامل على Pi — 24 تطبيق، هوية واحدة، مدفوعات Pi حقيقية. ساعدنا في الإطلاق: افتح التطبيقات تحت في متصفح Pi وجرّبها. الرُوّاد الأوائل هم من يرسمون القادم.',
    callout: 'افتح الصفحة دي جوّه متصفح Pi، وتأكد إن حساب Pi بتاعك مُوثّق (KYC) — ده اللي بيخلّي زيارتك تتحسب.',
    stepsTitle: 'إزاي تبقى Pioneer — 3 خطوات',
    steps: [
      { n: '1', title: 'افتح في متصفح Pi', body: 'اضغط على أي تطبيق تحت من جوّه تطبيق Pi Browser. بيفتح على دومين Pi الخاص بيه.' },
      { n: '2', title: 'سجّل دخول بـ Pi', body: 'سجّل دخول مرة واحدة بحساب Pi. الجلسة بتمشي معاك في كل تطبيقات TEC (تسجيل دخول موحّد).' },
      { n: '3', title: 'جرّب إجراء واحد', body: 'اعمل حاجة واحدة في كل تطبيق — تتصفّح، تنشئ، أو دفعة Pi صغيرة. الإجراء الصغير ده هو بصمتك كـ Pioneer.' },
    ],
    appsTitle: 'الـ 24 تطبيق — كلهم شغّالين',
    appsLead: 'اضغط علشان تفتح كل واحد في متصفح Pi. ابدأ بـ Hub، وبعدين استكشف.',
    footer: 'شكراً لريادتك لـ TEC. كل تطبيق بتفتحه وكل Pi بتصرفه بيساعد اقتصاد Pi حقيقي إنه يشتغل.',
  },
};

export default function PioneersClient() {
  const { locale, dir } = useTranslation();
  const t = COPY[locale];

  const page: React.CSSProperties = {
    minHeight: '100vh', background: C.bg, color: C.text, direction: dir,
    padding: '28px 20px 56px',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  };
  const inner: React.CSSProperties = { maxWidth: 720, margin: '0 auto' };
  const card: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.gold}22`, borderRadius: 14, padding: 16,
  };

  return (
    <main style={page}>
      <div style={inner}>
        {/* Top bar — eyebrow + language */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: C.green, boxShadow: `0 0 0 4px ${C.green}22`, display: 'inline-block' }} />
            <span style={{ fontSize: 11, letterSpacing: 0.6, color: C.subtext, textTransform: 'uppercase', fontWeight: 700 }}>{t.eyebrow}</span>
          </div>
          <LanguageSwitcher />
        </div>

        {/* Hero */}
        <header style={{ marginTop: 22 }}>
          <div style={{ fontSize: 30, fontWeight: 900 }}>🔷 TEC</div>
          <h1 style={{ fontSize: 30, fontWeight: 900, color: C.gold, margin: '10px 0 0', lineHeight: 1.15, textWrap: 'balance' as React.CSSProperties['textWrap'] }}>{t.h1}</h1>
          <p style={{ fontSize: 15, color: C.subtext, margin: '12px 0 0', lineHeight: 1.7 }}>{t.lead}</p>
        </header>

        {/* Pi Browser + KYC callout */}
        <div style={{ ...card, marginTop: 20, background: `${C.gold}14`, borderColor: `${C.gold}44`, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
          <p style={{ fontSize: 13, color: C.text, margin: 0, lineHeight: 1.6, fontWeight: 600 }}>{t.callout}</p>
        </div>

        {/* 3 steps */}
        <section style={{ marginTop: 30 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{t.stepsTitle}</h2>
          <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            {t.steps.map((s) => (
              <div key={s.n} style={{ ...card, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span style={{ flex: '0 0 auto', width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, ${C.gold}, ${C.goldDark})`, color: C.bg, fontWeight: 900, fontSize: 16, display: 'grid', placeItems: 'center' }}>{s.n}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: C.subtext, marginTop: 4, lineHeight: 1.6 }}>{s.body}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Apps grid — every LIVE domain from the registry */}
        <section style={{ marginTop: 34 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{t.appsTitle}</h2>
            <span style={{ fontSize: 11, color: C.green, border: `1px solid ${C.green}55`, borderRadius: 999, padding: '2px 10px', fontWeight: 700 }}>{LIVE_DOMAINS.length} live</span>
          </div>
          <p style={{ fontSize: 13, color: C.subtext, margin: '6px 0 14px', lineHeight: 1.6 }}>{t.appsLead}</p>

          <div style={{ display: 'grid', gap: 10 }}>
            {LIVE_DOMAINS.map((d) => (
              <a
                key={d.slug}
                href={linkFor(d.slug, d.route)}
                style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}
              >
                <span style={{ fontSize: 24, lineHeight: 1, flex: '0 0 auto' }}>{d.emoji}</span>
                <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: C.text }}>{d.name[locale]}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: C.subtext, marginTop: 2, lineHeight: 1.5 }}>{d.description[locale]}</span>
                  <span style={{ display: 'block', fontSize: 11, color: C.gold, marginTop: 4, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{d.piDomain}</span>
                </span>
                <span style={{ flex: '0 0 auto', fontSize: 20, color: C.gold, transform: dir === 'rtl' ? 'scaleX(-1)' : 'none' }}>›</span>
              </a>
            ))}
          </div>
        </section>

        <p style={{ fontSize: 12, color: C.subtext, margin: '30px 0 0', lineHeight: 1.7, textAlign: 'center' }}>{t.footer}</p>
      </div>
    </main>
  );
}
