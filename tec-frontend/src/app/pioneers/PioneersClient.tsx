'use client';

// TEC Founding 100 — Pioneer campaign shell. Reads the LIVE apps straight from the Hub
// domain registry (single source of truth — @/domains/_registry), so this page never
// drifts from what is actually live. Bilingual EN/AR via the Hub i18n locale + dir.
//
// The campaign is a "Pioneer Quest": open every live app in Pi Browser (engagement is
// per-App-ID, so each app must be opened at its OWN domain). We track the visitor's OWN
// progress locally (localStorage) — no fabricated global counters. Completing the quest
// is the path to the Founding Pioneer badge (first 100 — a real limit, granted later via
// the reputation layer). Inline styles only (Pi Browser safe — no CSS modules/Tailwind).
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { LIVE_DOMAINS } from '@/domains/_registry';
import { useKyc } from '@/lib-client/hooks/useKyc';

// TEC EVL tokens (C-83) — inlined so the page is self-contained in Pi Browser.
const C = {
  bg: '#050816', surface: '#0B1020', surface2: '#111627',
  gold: '#FBBF24', goldDark: '#F59E0B',
  text: '#E5E7EB', subtext: '#94A3B8', green: '#22C55E', purple: '#8B5CF6',
};

const QUEST_KEY = 'tec_pioneer_quest';       // slugs the visitor has opened
const FOUNDING_CAP = 100;                     // the Founding 100 limit (real rule)

// The Pioneer opens each app at its OWN domain. The registry route is the source of
// truth: a full https URL → the app's domain; a relative path → a Hub-internal app
// (same origin, already inside Pi Browser). Fall back to the canonical web domain.
function linkFor(slug: string, route: string | null): string {
  if (route && (route.startsWith('http') || route.startsWith('/'))) return route;
  return `https://${slug}.tecosystem.app`;
}

type Copy = {
  eyebrow: string; founding: string; h1: string; lead: string;
  callout: string;
  questTitle: string; questSub: (done: number, total: number) => string;
  questGate: string;
  tierGettingStarted: string; tierExplorer: string; tierBuilder: string; tierFounding: string;
  questDoneBanner: string;
  stepsTitle: string; steps: { n: string; title: string; body: string }[];
  appsTitle: string; appsLead: string; opened: string;
  badgeTitle: string; badgeBody: string;
  foundingLive: (claimed: number, remaining: number) => string;
  youAreFounding: (n: number) => string;
  kycNeeded: string;
  footer: string;
};

const COPY: Record<'en' | 'ar', Copy> = {
  en: {
    eyebrow: 'TEC Ecosystem · Live on Pi Mainnet',
    founding: '★ Founding 100',
    h1: 'Become a TEC Founding Pioneer',
    lead: 'TEC is a full economy on Pi — 24 apps, one identity, real Pi payments. The first 100 Pioneers to complete the Quest earn a permanent Founding Pioneer badge in their TEC reputation. Early, limited, and yours forever.',
    callout: 'Open this page inside Pi Browser with a KYC-verified Pi account — that is what lets your visit count toward the Founding 100.',
    questTitle: 'Your Pioneer Quest',
    questSub: (d, t) => `${d} of ${t} apps opened`,
    questGate: 'Log in with a KYC-verified Pi account to start your Pioneer Quest and earn the Founding badge. Browsing every app below is open to everyone.',
    tierGettingStarted: 'Getting started',
    tierExplorer: 'Explorer · 5 apps',
    tierBuilder: 'Builder · 12 apps',
    tierFounding: 'Founding Pioneer · all 24',
    questDoneBanner: '🎉 Quest complete — you opened all 24. You qualify for the Founding Pioneer badge.',
    stepsTitle: 'How it works — 3 steps',
    steps: [
      { n: '1', title: 'Open in Pi Browser', body: 'Tap any app below from inside Pi Browser. It opens on its own Pi domain and ticks your Quest.' },
      { n: '2', title: 'Log in with Pi', body: 'Sign in once with your Pi account — your session carries across all TEC apps (single sign-on).' },
      { n: '3', title: 'Try one action', body: 'Do one thing in each app — browse, create, or a small Pi payment. That is your Pioneer footprint.' },
    ],
    appsTitle: 'The 24 apps — all live',
    appsLead: 'Tap each to open it in Pi Browser. Opened apps are checked off your Quest.',
    opened: 'Opened',
    badgeTitle: '★ The Founding Pioneer badge',
    badgeBody: 'A permanent recognition in your TEC reputation (Legend / VIP) — reserved for the first 100 Pioneers to complete the Quest. It cannot be bought, only earned. Founding Pioneers get early access to new apps and features first.',
    foundingLive: (c, r) => `${c} of ${FOUNDING_CAP} Founding spots claimed · ${r} left`,
    youAreFounding: (n) => `🎉 You are Founding Pioneer #${n} — welcome.`,
    kycNeeded: 'Only KYC-verified Pioneers earn the Founding badge. Verify your Pi account to claim your spot — your progress is saved.',
    footer: 'Thank you for pioneering TEC. Every app you open and every Pi you spend helps a real Pi-native economy go live.',
  },
  ar: {
    eyebrow: 'منظومة TEC · شغّالة على Pi Mainnet',
    founding: '★ نادي الـ 100 المؤسّس',
    h1: 'كن من مؤسّسي TEC — Founding Pioneer',
    lead: 'TEC اقتصاد كامل على Pi — 24 تطبيق، هوية واحدة، مدفوعات Pi حقيقية. أول 100 Pioneer يكمّلوا الـ Quest بياخدوا شارة "Founding Pioneer" دائمة في سمعتهم داخل TEC. مبكرة، محدودة، وليك للأبد.',
    callout: 'افتح الصفحة دي جوّه متصفح Pi وبحساب Pi مُوثّق (KYC) — ده اللي بيخلّي زيارتك تتحسب ضمن الـ 100 المؤسّس.',
    questTitle: 'مهمّتك كـ Pioneer',
    questSub: (d, t) => `فتحت ${d} من ${t} تطبيق`,
    questGate: 'سجّل دخول بحساب Pi مُوثّق (KYC) عشان تبدأ مهمّتك وتكسب شارة Founding. تصفّح كل التطبيقات تحت متاح للجميع.',
    tierGettingStarted: 'البداية',
    tierExplorer: 'مستكشف · 5 تطبيقات',
    tierBuilder: 'باني · 12 تطبيق',
    tierFounding: 'مؤسّس · الـ 24 كلهم',
    questDoneBanner: '🎉 المهمّة اكتملت — فتحت الـ 24 كلهم. إنت مؤهّل لشارة Founding Pioneer.',
    stepsTitle: 'إزاي تشتغل — 3 خطوات',
    steps: [
      { n: '1', title: 'افتح في متصفح Pi', body: 'اضغط أي تطبيق تحت من جوّه Pi Browser. بيفتح على دومين Pi الخاص بيه ويتحسب في مهمّتك.' },
      { n: '2', title: 'سجّل دخول بـ Pi', body: 'سجّل دخول مرة واحدة بحساب Pi — الجلسة بتمشي معاك في كل تطبيقات TEC (دخول موحّد).' },
      { n: '3', title: 'جرّب إجراء واحد', body: 'اعمل حاجة واحدة في كل تطبيق — تتصفّح، تنشئ، أو دفعة Pi صغيرة. دي بصمتك كـ Pioneer.' },
    ],
    appsTitle: 'الـ 24 تطبيق — كلهم شغّالين',
    appsLead: 'اضغط كل واحد علشان تفتحه في متصفح Pi. اللي بتفتحه بيتشطّب في مهمّتك.',
    opened: 'مفتوح',
    badgeTitle: '★ شارة Founding Pioneer',
    badgeBody: 'تقدير دائم في سمعتك داخل TEC (Legend / VIP) — محجوزة لأول 100 Pioneer يكمّلوا الـ Quest. متتشريش، بس تتكسب. المؤسّسون بياخدوا وصول مبكر للتطبيقات والمزايا الجديدة قبل الكل.',
    foundingLive: (c, r) => `اتحجز ${c} من ${FOUNDING_CAP} مكان مؤسّس · باقي ${r}`,
    youAreFounding: (n) => `🎉 إنت Founding Pioneer رقم #${n} — أهلاً بيك.`,
    kycNeeded: 'شارة Founding للـ Pioneers المُوثّقين (KYC) بس. وثّق حساب Pi عشان تحجز مكانك — تقدّمك محفوظ.',
    footer: 'شكراً لريادتك لـ TEC. كل تطبيق بتفتحه وكل Pi بتصرفه بيساعد اقتصاد Pi حقيقي إنه يشتغل.',
  },
};

export default function PioneersClient() {
  const { locale, dir } = useTranslation();
  const t = COPY[locale];
  const total = LIVE_DOMAINS.length;

  // Only a logged-in, KYC-verified Pioneer accrues Quest progress + the ✓ marks.
  // Browsing every app stays open to everyone; the Quest itself is KYC-gated (the
  // Founding cohort must be KYC-only). `kyc` is null for logged-out / non-verified.
  const { kyc, isLoading: kycLoading } = useKyc();
  const eligible = kyc?.status === 'VERIFIED';

  // The visitor's OWN quest progress. localStorage is the instant, offline-safe
  // hint; the server (when logged in + deployed) is authoritative and the source of
  // the REAL Founding counter + badge number. Merged as a union so nothing is lost.
  const [visited, setVisited] = useState<string[]>([]);
  const [serverStats, setServerStats] = useState<{ claimed: number; remaining: number } | null>(null);
  const [foundingNumber, setFoundingNumber] = useState<number | null>(null);
  const [kycNeeded, setKycNeeded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(QUEST_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setVisited(arr.filter((x) => typeof x === 'string'));
      }
    } catch { /* ignore — start fresh */ }
  }, []);

  // Pull the REAL campaign counter (public) + the caller's own quest (if logged in).
  // Both degrade silently — a logged-out visitor or an undeployed backend just keeps
  // the local-only view.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/bff/pioneer/stats', { credentials: 'include' });
        const s = (await r.json().catch(() => null))?.data?.stats;
        if (alive && s && typeof s.founding_claimed === 'number') {
          setServerStats({ claimed: s.founding_claimed, remaining: s.founding_remaining });
        }
      } catch { /* keep local-only */ }
      try {
        const r = await fetch('/api/bff/pioneer/me', { credentials: 'include' });
        const q = (await r.json().catch(() => null))?.data?.quest;
        if (alive && q) {
          if (Array.isArray(q.opened_apps)) {
            setVisited((prev) => Array.from(new Set([...prev, ...q.opened_apps])));
          }
          if (typeof q.founding_number === 'number') setFoundingNumber(q.founding_number);
          // Logged-in but not KYC-verified (and no number yet) → nudge to verify.
          if (q.founding_number == null && q.kyc_verified === false) setKycNeeded(true);
        }
      } catch { /* not logged in / backend down — local-only */ }
    })();
    return () => { alive = false; };
  }, []);

  const markVisited = useCallback((slug: string) => {
    // Non-verified visitors browse freely but never accrue progress or a ✓ mark.
    if (!eligible) return;
    setVisited((prev) => {
      if (prev.includes(slug)) return prev;
      const next = [...prev, slug];
      try { localStorage.setItem(QUEST_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    // Best-effort server record (only succeeds when logged in) — the authoritative
    // source of the Founding counter + badge. Silent on failure; local still shows.
    try {
      const csrf = typeof document !== 'undefined'
        ? (document.cookie.match(/(?:^|;\s*)tec_csrf=([^;]+)/)?.[1] ?? '')
        : '';
      void fetch('/api/bff/pioneer/open', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': decodeURIComponent(csrf) } : {}) },
        body:        JSON.stringify({ app: slug }),
      }).catch(() => {});
    } catch { /* ignore */ }
  }, [eligible]);

  // Progress (and the ✓ marks) only count for a verified pioneer.
  const effectiveVisited = eligible ? visited : [];
  const done = effectiveVisited.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const complete = done >= total;

  const page: React.CSSProperties = {
    minHeight: '100vh', background: C.bg, color: C.text, direction: dir,
    padding: '28px 20px 56px',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  };
  const inner: React.CSSProperties = { maxWidth: 720, margin: '0 auto' };
  const card: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.gold}22`, borderRadius: 14, padding: 16,
  };

  // Quest tier label from progress.
  const tier =
    done >= total ? t.tierFounding
    : done >= 12  ? t.tierBuilder
    : done >= 5   ? t.tierExplorer
    : t.tierGettingStarted;

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
          <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 800, color: C.gold, background: `${C.gold}18`, border: `1px solid ${C.gold}55`, borderRadius: 999, padding: '4px 12px', letterSpacing: 0.3 }}>{t.founding}</span>
          <h1 style={{ fontSize: 30, fontWeight: 900, color: C.gold, margin: '14px 0 0', lineHeight: 1.15, textWrap: 'balance' as React.CSSProperties['textWrap'] }}>{t.h1}</h1>
          <p style={{ fontSize: 15, color: C.subtext, margin: '12px 0 0', lineHeight: 1.7 }}>{t.lead}</p>
        </header>

        {/* Quest — progress for a verified pioneer; a KYC gate otherwise. Browsing
            the apps below stays open to everyone; only the Quest is KYC-gated. */}
        {eligible ? (
          <section style={{ ...card, marginTop: 22, background: C.surface2 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{t.questTitle}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: complete ? C.green : C.gold }}>{tier}</span>
            </div>
            <div style={{ marginTop: 12, height: 12, borderRadius: 999, background: '#000', overflow: 'hidden', border: `1px solid ${C.gold}22` }}>
              <div style={{ width: `${pct}%`, height: '100%', background: complete ? `linear-gradient(90deg, ${C.green}, ${C.gold})` : `linear-gradient(90deg, ${C.goldDark}, ${C.gold})`, transition: 'width 300ms ease' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontSize: 13, color: C.subtext }}>{t.questSub(done, total)}</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: C.gold, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
            </div>
            {complete && (
              <p style={{ fontSize: 13, color: C.green, margin: '12px 0 0', fontWeight: 700, lineHeight: 1.5 }}>{t.questDoneBanner}</p>
            )}
          </section>
        ) : !kycLoading ? (
          <section style={{ ...card, marginTop: 22, background: `${C.gold}12`, borderColor: `${C.gold}44` }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.gold }}>🔐 {t.questTitle}</div>
            <p style={{ fontSize: 13, color: C.text, margin: '8px 0 0', lineHeight: 1.7 }}>{t.questGate}</p>
          </section>
        ) : null}

        {/* Pi Browser + KYC callout */}
        <div style={{ ...card, marginTop: 16, background: `${C.gold}14`, borderColor: `${C.gold}44`, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
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

        {/* Apps grid — every LIVE domain; tapping ticks the Quest */}
        <section style={{ marginTop: 34 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{t.appsTitle}</h2>
            <span style={{ fontSize: 11, color: C.green, border: `1px solid ${C.green}55`, borderRadius: 999, padding: '2px 10px', fontWeight: 700 }}>{total} live</span>
          </div>
          <p style={{ fontSize: 13, color: C.subtext, margin: '6px 0 14px', lineHeight: 1.6 }}>{t.appsLead}</p>

          <div style={{ display: 'grid', gap: 10 }}>
            {LIVE_DOMAINS.map((d) => {
              const isDone = eligible && visited.includes(d.slug);
              return (
                <a
                  key={d.slug}
                  href={linkFor(d.slug, d.route)}
                  onClick={() => markVisited(d.slug)}
                  style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', borderColor: isDone ? `${C.green}55` : `${C.gold}22` }}
                >
                  <span style={{ fontSize: 24, lineHeight: 1, flex: '0 0 auto' }}>{d.emoji}</span>
                  <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: C.text }}>{d.name[locale]}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: C.subtext, marginTop: 2, lineHeight: 1.5 }}>{d.description[locale]}</span>
                    <span style={{ display: 'block', fontSize: 11, color: C.gold, marginTop: 4, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{d.piDomain}</span>
                  </span>
                  {isDone
                    ? <span style={{ flex: '0 0 auto', fontSize: 11, fontWeight: 800, color: C.green, border: `1px solid ${C.green}66`, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>✓ {t.opened}</span>
                    : <span style={{ flex: '0 0 auto', fontSize: 20, color: C.gold, transform: dir === 'rtl' ? 'scaleX(-1)' : 'none' }}>›</span>}
                </a>
              );
            })}
          </div>
        </section>

        {/* Founding badge explainer */}
        <section style={{ ...card, marginTop: 30, background: `${C.purple}12`, borderColor: `${C.purple}44` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.gold }}>{t.badgeTitle}</div>
          <p style={{ fontSize: 13, color: C.text, margin: '8px 0 0', lineHeight: 1.7 }}>{t.badgeBody}</p>
          {foundingNumber != null && (
            <div style={{ fontSize: 13, color: C.green, marginTop: 10, fontWeight: 800 }}>{t.youAreFounding(foundingNumber)}</div>
          )}
          {foundingNumber == null && kycNeeded && (
            <div style={{ fontSize: 12.5, color: C.gold, marginTop: 10, fontWeight: 700, lineHeight: 1.5 }}>🔐 {t.kycNeeded}</div>
          )}
          <div style={{ fontSize: 11, color: C.subtext, marginTop: 10, fontWeight: 700, letterSpacing: 0.3 }}>
            {serverStats ? t.foundingLive(serverStats.claimed, serverStats.remaining) : `${t.founding} · ${FOUNDING_CAP}`}
          </div>
        </section>

        <p style={{ fontSize: 12, color: C.subtext, margin: '28px 0 0', lineHeight: 1.7, textAlign: 'center' }}>{t.footer}</p>
      </div>
    </main>
  );
}
