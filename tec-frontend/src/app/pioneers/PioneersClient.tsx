'use client';

// TEC Founding 100 — Pioneer campaign shell. Reads the LIVE apps straight from the Hub
// domain registry (single source of truth — @/domains/_registry), so this page never
// drifts from what is actually live. Bilingual EN/AR via the Hub i18n locale + dir.
//
// The campaign is a "Pioneer Quest": open every live app in Pi Browser. Each app opens
// at its registry route — its own Pi domain for standalone apps, or a Hub-internal route
// for apps that live inside the Hub. We track the visitor's OWN progress locally
// (localStorage) as an offline hint — no fabricated global counters. Completing the quest
// is the path to the Founding Pioneer badge (first 100 — a real limit, granted later via
// the reputation layer). Inline styles only (Pi Browser safe — no CSS modules/Tailwind).
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { LIVE_DOMAINS } from '@/domains/_registry';
import { usePiAuth } from '@/lib-client/hooks/usePiAuth';
import { getSource } from '@/lib-client/campaign';
import { rememberReturn } from '@/lib-client/return-to';

// TEC EVL tokens (C-83) — inlined so the page is self-contained in Pi Browser.
const C = {
  bg: '#050816', surface: '#0B1020', surface2: '#111627',
  gold: 'var(--tec-gold)', goldDark: 'var(--tec-gold-dark)',
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

/**
 * Mark a Quest link so the app can offer a way back here.
 *
 * ── Why the app has to carry the way back ──────────────────────────────────
 *
 * Pi Browser HAS NO TABS. Its top-right control opens an "About Current URL"
 * panel with a recently-visited list — so `target="_blank"` is inert there and
 * this page does not stay open behind the visit. That leaves the single history
 * stack, and the first visit to any app pushes the whole SSO chain onto it:
 * pressing back from the app surfaces at the HUB'S OWN LANDING PAGE, a "Sign in
 * with Pi" screen for a session the pioneer already has. Observed on a phone,
 * not theorised.
 *
 * A forward navigation to a known URL is the only return that behaves the same
 * in every browser. The app renders it — and renders it ONLY for a visitor who
 * came from here, because these are real apps with real users and a permanent
 * campaign bar would be wrong for all of them.
 *
 * `q=1` and nothing else: the value is matched, never echoed, so this cannot
 * become a way to put text on somebody else's screen.
 */
function withQuestMark(href: string): string {
  try {
    const u = new URL(href);
    u.searchParams.set('q', '1');
    return u.toString();
  } catch {
    // Not absolute — a same-origin Hub route, which needs no marker anyway.
    return href;
  }
}

/**
 * A cross-domain app link, opened so the app gets its OWN Pi session.
 *
 * ── The observation this is built on ────────────────────────────────────────
 *
 * The same Pi payment, run two ways, produced two different verdicts in the Pi
 * Developer Portal:
 *
 *     paid from the Hub modal   →  π moved · Portal checklist step FAILED
 *     paid inside the app       →  π moved · Portal checklist step PASSED
 *
 * The money moved both times. Pi only COUNTED the second. Which says Pi does not
 * credit "a transaction happened for this app" — it credits "this app ran the Pi
 * SDK on its own domain and did the transaction itself". Paid from the Hub, the
 * app Pi sees is the HUB.
 *
 * The `.pi` claim threshold — 5 unique KYC'd pioneers engaging with the app — is
 * the same kind of counter, so it almost certainly has the same blind spot.
 *
 * ── Why a plain link could never feed it ────────────────────────────────────
 *
 * Every app's layout skips the Pi SDK when it detects a Hub entry, and does not
 * merely leave it un-init'd — `pi-sdk.js` is NOT LOADED (ADR-007: touching Pi in
 * a Hub-owned session poisons it and breaks the Hub's own PaymentModal). The
 * detector is `document.referrer` plus a `__tec_hub_entry` sessionStorage flag.
 *
 * A plain `<a>` from this page sets that referrer. So every Quest tap landed in
 * an app that deliberately never spoke to Pi — the Hub's counter recorded an
 * arrival, and Pi recorded nothing. Eight pioneers across twenty-three apps,
 * invisible to the only register that decides the domains.
 *
 * ── What this does, and what it does not promise ────────────────────────────
 *
 *   target="_blank"  a new tab, so this page survives the trip — the Quest can
 *                    be worked down in one sitting instead of once per
 *                    round-trip through a sign-in redirect.
 *                    It also gives the app a FRESH sessionStorage, so a
 *                    `__tec_hub_entry` flag left by an earlier SSO hop in
 *                    another tab cannot follow it in.
 *   rel="noreferrer" removes the referrer, so the app sees a standalone visit
 *                    and loads the SDK.
 *   rel="noopener"   the opened tab gets no handle on this one. Standard with
 *                    `_blank`, and not optional on a page that lists outbound
 *                    links.
 *
 * This removes the DETECTOR. Whether Pi Browser then actually gives the app its
 * own Pi app context is Pi Browser's decision, not ours — so this is the app
 * being given its chance to register, not a guarantee that it did. The way to
 * know is to measure it: the arrival report can carry whether the SDK really
 * initialised, and the coverage screen can show that number beside `arrived`.
 * Until then, read the Portal checklist, not this code.
 */
const APP_LINK_PROPS = { target: '_blank', rel: 'noopener noreferrer' } as const;

/**
 * TRIAL: apps that open in THIS tab instead of a new one.
 *
 * Seen on a phone: open an app from here, press back, and Pi Browser closed
 * altogether instead of returning to the Quest. `_blank` does not give Pi
 * Browser a tab it can go back from — it gives it a fresh context whose history
 * holds only the app, so back has nowhere to go but out.
 *
 * In the same tab the history is `/pioneers → app`, and back returns here.
 * What is being tested is the cost: a same-tab visit keeps the app's
 * sessionStorage, so a `__tec_hub_entry` flag from an earlier SSO hop could
 * still make the app skip the Pi SDK — the thing this whole page is for. The
 * referrer is stripped either way.
 *
 * One app, confirmed on a phone (back returns here; the Portal still counts the
 * visit), before it becomes every app.
 */
const SAME_TAB_TRIAL: ReadonlySet<string> = new Set(['zone']);
const SAME_TAB_PROPS = { rel: 'noreferrer' } as const;

const linkPropsFor = (slug: string, external: boolean) =>
  !external ? {} : SAME_TAB_TRIAL.has(slug) ? SAME_TAB_PROPS : APP_LINK_PROPS;

/** Same-origin Hub routes (`/hub`) keep normal navigation: there is no Pi
 *  session to protect and no referrer worth stripping — it is this app. */
const isExternal = (href: string) => href.startsWith('http');

type Copy = {
  eyebrow: string; founding: string; h1: string; lead: string;
  heroTrust: string; heroCta: string; heroRecognition: string;
  callout: string;
  questTitle: string; questSub: (done: number, total: number) => string;
  questGate: string;
  tierGettingStarted: string; tierExplorer: string; tierBuilder: string;
  tierFounding: (total: number) => string;
  questDoneBanner: (total: number) => string;
  stepsTitle: string; steps: { n: string; title: string; body: string }[];
  appsTitle: (total: number) => string; appsLead: string; opened: string;
  /** Said where the tapping happens, not only in the gate card above it. */
  appsSignedOut: string;
  /** Where a Founding Pioneer actually sees the PRO the page promised them. */
  seePro: string;
  /** Said INSTEAD of `seePro` while commerce has not confirmed the gift. */
  proPending: string;
  badgeTitle: string; badgeBody: string;
  foundingLive: (claimed: number, remaining: number) => string;
  youAreFounding: (n: number) => string;
  /**
   * What the Quest actually asks of you — which is nothing beyond a Pi account.
   *
   * This was `kycNeeded`, and it told every reader that a Pi-KYC-verified
   * account was "one condition". The code has never checked that: `recordOpen`
   * grants the Founding number to any signed-in Pi account, and the service
   * says so in as many words — `kyc_verified` is RECORDED, NOT ENFORCED.
   *
   * The FAQ, meanwhile, said KYC was Pi's business and not a requirement here.
   * So one question a cautious Pi user will certainly ask had three different
   * answers, and the loudest one was the one the system did not follow.
   *
   * Verification still matters — it is what Pi counts toward a `.pi` domain
   * claim — but that is a fact about the domains, not a condition on the badge,
   * and the two must not be worded as if they were the same rule.
   */
  openToAll: (total: number) => string;
  footer: string;
  share: string; shareCopied: string; shareText: (total: number) => string; faq: string;
  statPioneers: string; statCompleted: string; statFounding: string; liveLabel: string;
};

const COPY: Record<'en' | 'ar', Copy> = {
  en: {
    eyebrow: 'TEC Ecosystem · Live on Pi Mainnet',
    founding: '★ Founding 100',
    h1: 'TEC is live on Pi Mainnet',
    lead: '24 connected apps · One Pi identity · Real Pi utility.',
    heroTrust: '⏱️ A few minutes · Free · No payment, ever · No documents, no KYC · from Pi Browser',
    heroCta: '🚀 Start the Pioneer Quest',
    heroRecognition: 'Complete the Quest to earn Founding Pioneer recognition — plus 6 months of TEC PRO. ⭐ Only the first 100 qualify.',
    callout: 'For the full Pioneer experience, open TEC in Pi Browser and sign in with Pi.',
    questTitle: 'Your Pioneer Quest',
    questSub: (d, t) => `${d} of ${t} explored`,
    questGate: 'Log in with your Pi account to start your Pioneer Quest. Browsing every app below is open to everyone.',
    tierGettingStarted: 'Getting started',
    tierExplorer: 'Explorer · 5 apps',
    tierBuilder: 'Builder · 12 apps',
    tierFounding: (total) => `Founding Pioneer · all ${total}`,
    questDoneBanner: (total) => `🎉 Quest complete — you opened all ${total}. You qualify for the Founding Pioneer badge.`,
    stepsTitle: 'How it works — 3 steps',
    steps: [
      { n: '1', title: 'Open in Pi Browser', body: 'Tap any app below from inside Pi Browser. It opens the app and ticks your Quest.' },
      { n: '2', title: 'Log in with Pi', body: 'Sign in once with your Pi account — your session carries across all TEC apps (single sign-on).' },
      { n: '3', title: 'Try one action', body: 'Do one thing in each app — browse, create, or a small Pi payment. That is your Pioneer footprint.' },
    ],
    appsTitle: (total) => `Explore the ${total} apps · all live`,
    appsLead: 'Explore the TEC ecosystem at your own pace — tap any app and it opens in a new tab, so this page stays here and you can keep going. Each one you explore ticks your Quest.',
    appsSignedOut: '⚠️ You are not signed in — these open normally, but nothing is counted toward your Quest. Sign in with Pi first so the apps you open are kept.',
    opened: 'Explored',
    badgeTitle: '★ The Founding Pioneer badge',
    badgeBody: 'A permanent recognition in your TEC reputation (Legend / VIP) — reserved for the first 100 Pioneers to complete the Quest. It cannot be bought, only earned. Every Founding Pioneer also receives 6 months of TEC PRO across the ecosystem — a 6-month period, not a permanent plan — and early access to new apps and features first.',
    foundingLive: (c, r) => `${c} of ${FOUNDING_CAP} Founding spots claimed · ${r} left`,
    youAreFounding: (n) => `🎉 You are Founding Pioneer #${n} — welcome.`,
    seePro: 'See your 6 months of PRO ›',
    proPending: 'Your 6 months of PRO is being activated — open this page again in a few minutes.',
    openToAll: (total) => `Open all ${total} apps to complete the Quest — free, and no payment at any point. Any Pi account qualifies: no documents, and no TEC verification step. Whether your Pi account is verified is Pi's business, not ours — we never ask, and we cannot see it.`,
    footer: 'Thank you for pioneering TEC. Every app you open and every Pi you spend helps a real Pi-native economy go live.',
    share: 'Share',
    shareCopied: 'Link copied ✓',
    shareText: (total) => `I'm becoming a TEC Founding Pioneer — a full economy on Pi with ${total} apps, one identity, real Pi payments. Join the Founding 100:`,
    faq: 'Questions? Read the Pioneer FAQ',
    statPioneers: 'Pioneers joined',
    statCompleted: 'Completed the Quest',
    statFounding: 'Founding claimed',
    liveLabel: 'Live',
  },
  ar: {
    eyebrow: 'منظومة TEC · شغّالة على Pi Mainnet',
    founding: '★ نادي الـ 100 المؤسّس',
    h1: 'TEC شغّال على Pi Mainnet',
    lead: '24 تطبيق مترابط · هوية Pi واحدة · استخدام حقيقي داخل المنظومة.',
    heroTrust: '⏱️ كام دقيقة · مجانًا · من غير أي دفع · من غير مستندات ولا KYC · من متصفح Pi',
    heroCta: '🚀 ابدأ Pioneer Quest',
    heroRecognition: 'كمّل الـ Quest علشان تحصل على تقدير Founding Pioneer — وكمان ٦ شهور TEC PRO. ⭐ أول 100 فقط مؤهلين.',
    callout: 'لأفضل تجربة Pioneer، افتح TEC من متصفح Pi وسجّل دخول بحساب Pi.',
    questTitle: 'مهمّتك كـ Pioneer',
    questSub: (d, t) => `استكشفت ${d} من ${t}`,
    questGate: 'سجّل دخول بحساب Pi عشان تبدأ مهمّتك. تصفّح كل التطبيقات تحت متاح للجميع.',
    tierGettingStarted: 'البداية',
    tierExplorer: 'مستكشف · 5 تطبيقات',
    tierBuilder: 'باني · 12 تطبيق',
    tierFounding: (total) => `مؤسّس · الـ ${total} كلهم`,
    questDoneBanner: (total) => `🎉 المهمّة اكتملت — فتحت الـ ${total} كلهم. إنت مؤهّل لشارة Founding Pioneer.`,
    stepsTitle: 'إزاي تشتغل — 3 خطوات',
    steps: [
      { n: '1', title: 'افتح في متصفح Pi', body: 'اضغط أي تطبيق تحت من جوّه Pi Browser. بيفتح التطبيق ويتحسب في مهمّتك.' },
      { n: '2', title: 'سجّل دخول بـ Pi', body: 'سجّل دخول مرة واحدة بحساب Pi — الجلسة بتمشي معاك في كل تطبيقات TEC (دخول موحّد).' },
      { n: '3', title: 'جرّب إجراء واحد', body: 'اعمل حاجة واحدة في كل تطبيق — تتصفّح، تنشئ، أو دفعة Pi صغيرة. دي بصمتك كـ Pioneer.' },
    ],
    appsTitle: (total) => `استكشف الـ ${total} تطبيق · كلهم شغّالين`,
    appsLead: 'استكشف منظومة TEC على راحتك — اضغط أي تطبيق يفتح في تبويب جديد، فالصفحة دي تفضل مكانها وتقدر تكمّل. كل واحد تستكشفه بيتشطّب في مهمّتك.',
    appsSignedOut: '⚠️ إنت مش مسجّل دخول — التطبيقات هتفتح عادي، بس مفيش حاجة هتتحسب في مهمّتك. سجّل دخول بـ Pi الأول علشان اللي تفتحه يتحفظ.',
    opened: 'مُستكشَف',
    badgeTitle: '★ شارة Founding Pioneer',
    badgeBody: 'تقدير دائم في سمعتك داخل TEC (Legend / VIP) — محجوزة لأول 100 Pioneer يكمّلوا الـ Quest. متتشريش، بس تتكسب. وكل Founding Pioneer بياخد كمان ٦ شهور TEC PRO في المنظومة كلها — مدة ٦ شهور، مش اشتراك دائم — ووصول مبكر للتطبيقات والمزايا الجديدة قبل الكل.',
    foundingLive: (c, r) => `اتحجز ${c} من ${FOUNDING_CAP} مكان مؤسّس · باقي ${r}`,
    youAreFounding: (n) => `🎉 إنت Founding Pioneer رقم #${n} — أهلاً بيك.`,
    seePro: 'شوف الـ ٦ شهور PRO بتاعتك ›',
    proPending: 'الـ ٦ شهور PRO بتاعتك بتتفعّل — افتح الصفحة دي تاني بعد دقايق.',
    openToAll: (total) => `افتح الـ ${total} تطبيق عشان تكمّل الـ Quest — مجانًا، ومن غير أي دفع في أي خطوة. أي حساب Pi مؤهّل: من غير مستندات، ومن غير أي خطوة توثيق في TEC. توثيق حسابك في Pi ده شأن Pi وحدها — إحنا مش بنطلبه ومش بنقدر نشوفه.`,
    footer: 'شكراً لريادتك لـ TEC. كل تطبيق بتفتحه وكل Pi بتصرفه بيساعد اقتصاد Pi حقيقي إنه يشتغل.',
    share: 'شارك',
    shareCopied: 'اتنسخ اللينك ✓',
    shareText: (total) => `أنا ببقى TEC Founding Pioneer — اقتصاد كامل على Pi بـ ${total} تطبيق، هوية واحدة، مدفوعات Pi حقيقية. انضم لنادي الـ 100 المؤسّس:`,
    faq: 'عندك أسئلة؟ اقرأ الـ Pioneer FAQ',
    statPioneers: 'Pioneers انضمّوا',
    statCompleted: 'كمّلوا الـ Quest',
    statFounding: 'أماكن مؤسّسة اتحجزت',
    liveLabel: 'مباشر',
  },
};

export default function PioneersClient() {
  const { locale, dir } = useTranslation();
  const t = COPY[locale];
  /** How many apps are live right now — what the grid below lists. */
  const liveCount = LIVE_DOMAINS.length;

  // The ✓ marks + Quest progress track engagement, so they gate on LOGIN — not on a
  // KYC flag (TEC does not store Pi-Network KYC status; its internal doc-KYC is a
  // different, rarely-completed flow). The Founding badge is earned by COMPLETING the
  // Quest (opening every live app) while logged in — no payment required, matching the
  // identity-service which grants the Founding number on completion. The server is the
  // authoritative source of that number; the UI never fabricates it. Browsing stays
  // open to everyone.
  const { isAuthenticated, isLoading: authLoading, user } = usePiAuth();
  const eligible = isAuthenticated;

  // Admin-only live counter: the public honest counter (joined / completed / founding
  // claimed) is shown ONLY to a configured owner, so cold campaign visitors never see
  // the early zeros. NEXT_PUBLIC_PIONEER_ADMINS = comma-separated Pi usernames — not a
  // secret, purely a UI gate (the /pioneer/stats endpoint stays public for the owner).
  const PIONEER_ADMINS = (process.env.NEXT_PUBLIC_PIONEER_ADMINS ?? '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const isPioneerAdmin = isAuthenticated
    && !!user?.piUsername
    && PIONEER_ADMINS.includes(user.piUsername.toLowerCase());

  // The visitor's OWN quest progress. localStorage is the instant, offline-safe
  // hint; the server (when logged in + deployed) is authoritative and the source of
  // the REAL Founding counter + badge number. Merged as a union so nothing is lost.
  const [visited, setVisited] = useState<string[]>([]);
  const [serverStats, setServerStats] = useState<{ claimed: number; remaining: number; pioneers: number; completed: number } | null>(null);
  const [foundingNumber, setFoundingNumber] = useState<number | null>(null);
  /**
   * Whether commerce has CONFIRMED this Founding member's PRO.
   *
   * The link below used to appear the moment a number did. But the gift is a
   * separate call to a separate service, and it could fail while the number
   * stood — so the page pointed somebody at "your 6 months of PRO" and the link
   * opened a FREE plan. That is the moment a new pioneer decides the whole
   * campaign was a lie.
   *
   * `null` means the backend did not say (an identity-service older than this
   * field) and keeps the old behaviour; only an explicit 'pending' holds the
   * link back.
   */
  const [foundingGift, setFoundingGift] = useState<'granted' | 'pending' | null>(null);
  const [shared, setShared] = useState(false);

  /**
   * How many apps the CAMPAIGN asks for — which is not the same number as how
   * many are live, and must not be derived from it.
   *
   * `LIVE_DOMAINS` is a runtime filter on `status === 'live'`. The service's
   * `QUEST_TARGET` is a frozen roster, deliberately, and its comment gives the
   * reason: "a campaign's terms must not move under the people running it".
   * That reasoning was applied on one side only, so the drift it protects
   * against landed here instead — take one app off `live` for an hour and this
   * page reads 23/23, 100%, and congratulates somebody the server will never
   * give a number to.
   *
   * `getStats()` publishes `quest_target` in the very response this page
   * already fetches. Reading it is the whole fix. The live count remains the
   * fallback for a first paint or an unreachable backend, and the grid keeps
   * listing every live app — a 25th that ships mid-round is a bonus, not a
   * newly-imposed requirement.
   */
  const [questTarget, setQuestTarget] = useState<number | null>(null);

  /**
   * Completion as the SERVER sees it — the only thing allowed to promise a badge.
   *
   * The progress bar may run on local state; it is the visitor's own hint and
   * being instant is the point. The banner is a different kind of sentence: it
   * tells somebody they have earned a capped, permanent recognition. A failed
   * `/open` POST leaves its tick in localStorage, the server merge is a union
   * that only ever adds, and the ✓ is exactly what stops the person tapping
   * again — so a local count can sit permanently one ahead of the truth, and
   * the loudest line on the page would be congratulating nobody.
   */
  const [serverCompleted, setServerCompleted] = useState(false);

  /** What the server has actually recorded — the basis for re-sending a lost tick. */
  const [serverOpened, setServerOpened] = useState<string[] | null>(null);


  /**
   * Take a quest row from the server and believe it.
   *
   * One function, because there are two places server truth arrives — the `/me`
   * read on load, and the `/open` write's own response — and they must not
   * disagree about what to do with it. Using the write's response is what lets
   * the badge appear on the tap that earns it rather than after a reload.
   *
   * `opened_apps` still merges as a union: the server is authoritative about
   * what it HAS, not about what this browser is still trying to send. What the
   * union used to hide is handled separately, by re-sending the difference.
   */
  const applyQuest = useCallback((q: {
    opened_apps?: unknown; founding_number?: unknown; completed_at?: unknown;
  }) => {
    if (Array.isArray(q.opened_apps)) {
      const apps = q.opened_apps.filter((x): x is string => typeof x === 'string');
      setServerOpened(apps);
      setVisited((prev) => Array.from(new Set([...prev, ...apps])));
    }
    if (typeof q.founding_number === 'number') setFoundingNumber(q.founding_number);
    // `completed_at` is the server's own verdict. Absent means not complete —
    // never "unknown, assume yes" (P6).
    setServerCompleted(q.completed_at != null);
  }, []);

  // Share the campaign — native share sheet where available (mobile / Pi Browser),
  // clipboard copy as the fallback. The link itself is the marketing asset.
  const handleShare = useCallback(async () => {
    const url  = typeof window !== 'undefined' ? `${window.location.origin}/pioneers` : 'https://hub.tecosystem.app/pioneers';
    const text = COPY[locale].shareText(LIVE_DOMAINS.length);
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'TEC Founding 100', text, url });
        return;
      }
    } catch { /* user cancelled or unsupported — fall through to copy */ }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setShared(true);
      setTimeout(() => setShared(false), 2200);
    } catch { /* clipboard blocked — nothing to do */ }
  }, [locale]);

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
        // The campaign's own target, from the campaign. Public, because the page
        // that states the terms is public.
        if (alive && typeof s?.quest_target === 'number' && s.quest_target > 0) {
          setQuestTarget(s.quest_target);
        }
        if (alive && s && typeof s.founding_claimed === 'number') {
          // Real, server-computed aggregates (the pioneer module owns pioneer state,
          // so it is the authoritative source of these counts — no fabricated numbers).
          setServerStats({
            claimed:   s.founding_claimed,
            remaining: s.founding_remaining,
            pioneers:  typeof s.total_pioneers === 'number' ? s.total_pioneers : 0,
            completed: typeof s.completed === 'number' ? s.completed : 0,
          });
        }
      } catch { /* keep local-only */ }
      try {
        const r = await fetch('/api/bff/pioneer/me', { credentials: 'include' });
        const body = await r.json().catch(() => null);
        const q = body?.data?.quest;
        if (alive && q) applyQuest(q);
        // Asked on this read because this read is what makes sure of it — the
        // service retries a gift that did not land the first time.
        const g = body?.data?.founding_gift;
        if (alive && (g === 'granted' || g === 'pending')) setFoundingGift(g);
      } catch { /* not logged in / backend down — local-only */ }
    })();
    return () => { alive = false; };
  }, [applyQuest]);

  /**
   * Tell the server this app was opened, and believe what it answers.
   *
   * Best-effort, and silent on failure — nobody asked for this request and it
   * must never interrupt a visit. What it is NOT any more is fire-and-forget:
   * the route returns the updated quest, so the response carries the Founding
   * number on the tap that earns it instead of on the next reload.
   */
  const sendOpen = useCallback(async (slug: string): Promise<void> => {
    try {
      const csrf = typeof document !== 'undefined'
        ? (document.cookie.match(/(?:^|;\s*)tec_csrf=([^;]+)/)?.[1] ?? '')
        : '';
      const source = getSource();
      const res = await fetch('/api/bff/pioneer/open', {
        method:      'POST',
        credentials: 'include',
        // keepalive: the app link navigates away in the same tab (its own domain),
        // which cancels an in-flight fetch — so the server open was lost and the quest
        // never completed server-side (local localStorage still showed 100%). keepalive
        // lets the browser finish the POST after navigation (like sendBeacon). Body is
        // tiny, well under the 64KB keepalive limit.
        keepalive:   true,
        headers:     { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': decodeURIComponent(csrf) } : {}) },
        // Said out loud although it is also the default: this page is the ONLY
        // thing that may tick the Founding Quest, and a default is a fact that
        // lives somewhere else. Written here, the rule is visible from the page
        // it belongs to.
        body:        JSON.stringify({ app: slug, origin: 'founding', ...(source ? { source } : {}) }),
      });
      if (!res.ok) return;
      const q = (await res.json().catch(() => null))?.data?.quest;
      if (q) applyQuest(q);
    } catch { /* offline, navigated away, blocked — the retry on next load covers it */ }
  }, [applyQuest]);

  const markVisited = useCallback((slug: string) => {
    /**
     * Remember this page BEFORE the visit takes the pioneer away.
     *
     * ── What the back button actually does in Pi Browser ────────────────────
     *
     * It does not go back one entry. Leaving an app returns you to the HUB'S
     * ROOT — `hub.tecosystem.app`, no path — whatever page you were on when
     * you left. Observed on a phone: from here, back landed on the Hub's
     * "Sign in with Pi" landing, not on this Quest.
     *
     * `/hub/campaign` appeared to be immune, and it is worth being exact about
     * why, because it is not the history: it lands on the same root, and the
     * root's own `takeReturn()` forwards it onward. **The recovery is the Hub
     * catching you, not the browser remembering.** This page never wrote
     * anything for it to catch.
     *
     * This is also why the `tec-auth@1.2.0` `location.replace` change produced
     * nothing visible here. It removes a real, redundant history entry — right
     * in any browser that reads history — and this one does not.
     *
     * Set OUTSIDE the eligibility guard below: a signed-out visitor still
     * browses apps and still deserves to land back here, even though nothing
     * about their visit is recorded.
     */
    try { rememberReturn('/pioneers'); } catch { /* ignore */ }

    // Non-verified visitors browse freely but never accrue progress or a ✓ mark.
    if (!eligible) return;
    setVisited((prev) => {
      if (prev.includes(slug)) return prev;
      const next = [...prev, slug];
      try { localStorage.setItem(QUEST_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    void sendOpen(slug);
  }, [eligible, sendOpen]);

  /**
   * Re-send the ticks the server never received.
   *
   * The ✓ is what stops somebody tapping an app a second time, so before this
   * the only retry path for a lost `/open` was one the interface actively
   * discouraged. A tick written during a backend blip stayed local forever, the
   * union merge could not remove it, and the quest silently never completed.
   *
   * Runs once, after `/me` has said what the server holds. The set difference
   * IS the list of what to re-send, and the writes are idempotent — the service
   * upserts distinct apps — so a redundant one costs nothing.
   */
  useEffect(() => {
    if (!eligible || serverOpened === null) return;
    const have    = new Set(serverOpened);
    const missing = visited.filter((s) => !have.has(s));
    if (missing.length === 0) return;
    let alive = true;
    (async () => {
      for (const slug of missing) {
        if (!alive) return;
        await sendOpen(slug);
      }
    })();
    return () => { alive = false; };
    // `visited` is deliberately not a dependency: this reconciles against what
    // the server reported, and re-running on every new tap would re-send the
    // one just sent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, serverOpened, sendOpen]);

  // Progress (and the ✓ marks) only count for a signed-in pioneer.
  const effectiveVisited = eligible ? visited : [];
  const done = effectiveVisited.length;
  // The campaign's target, from the campaign — see `questTarget`. The live count
  // is the fallback until the server answers.
  const total = questTarget ?? liveCount;
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  /**
   * The bar may run ahead; the promise may not.
   *
   * `complete` drives only the progress tier label. The banner — the sentence
   * that tells somebody they have earned one of a hundred permanent places —
   * reads `serverCompleted`, which comes from `completed_at` on the server's
   * own row. When the two disagree it is because a write was lost, and the
   * reconcile above is already re-sending it.
   */
  const complete = done >= total;

  /**
   * The live counters are for the OWNER, and nobody else. Ever.
   *
   * This briefly opened to the public above a floor of 10 claimed, on the
   * argument that scarcity is the strongest thing a capped-cohort page can say.
   * The argument was fine; the numbers are not scarcity. The cohort stands at 6
   * of 100 — and several of those are the owner's own test accounts — so a cold
   * visitor reads "6 claimed, 11 joined" as an empty room, not a closing door.
   *
   * A counter that argues against the page it sits on is worse than no counter,
   * and the page already carries the scarcity claim in words: "only the first
   * 100 qualify". That sentence does not need a number beside it to be true.
   *
   * Owner-gated, with no threshold and no path to opening. If that is ever
   * wanted again it should be a decision taken against the figures of the day,
   * not a rule that fires on its own.
   */
  const showCounters = !!serverStats && isPioneerAdmin;

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
    done >= total ? t.tierFounding(total)
    : done >= 12  ? t.tierBuilder
    : done >= 5   ? t.tierExplorer
    : t.tierGettingStarted;

  return (
    // C.bg is a fixed near-black in both themes, so the brand hue this page
    // reads has to be pinned to the dark-ground amber too.
    <main className="tec-on-dark" style={page}>
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
          <p style={{ fontSize: 16, color: C.text, margin: '12px 0 0', lineHeight: 1.7, fontWeight: 600 }}>{t.lead}</p>

          {/* Trust line — value-first, then remove the friction: free, no purchase, quick. */}
          <p style={{ fontSize: 13, color: C.subtext, margin: '10px 0 0', lineHeight: 1.7 }}>{t.heroTrust}</p>

          {/* Primary CTA — scroll to the quest card. Copy/anchor only; no logic. */}
          <a
            href="#pioneer-quest"
            style={{
              display: 'inline-block', marginTop: 16, textDecoration: 'none',
              fontSize: 15, fontWeight: 800, color: '#1a1205',
              background: `linear-gradient(135deg, ${C.gold}, ${C.goldDark})`,
              borderRadius: 999, padding: '11px 22px',
            }}
          >
            {t.heroCta}
          </a>

          {/* Recognition framing — Founding is recognition for completing, not the product. */}
          <p style={{ fontSize: 13, color: C.subtext, margin: '12px 0 0', lineHeight: 1.7 }}>{t.heroRecognition}</p>

          {/* Share + FAQ — the link is a marketing asset; the FAQ builds trust before login. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleShare}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer',
                fontSize: 13, fontWeight: 800, color: shared ? C.green : '#1a1205',
                background: shared ? `${C.green}22` : `linear-gradient(135deg, ${C.gold}, ${C.goldDark})`,
                border: shared ? `1px solid ${C.green}66` : 'none', borderRadius: 999, padding: '9px 16px',
              }}
            >
              <span aria-hidden>↗</span>{shared ? t.shareCopied : t.share}
            </button>
            <Link
              href="/pioneers/faq"
              style={{ fontSize: 13, fontWeight: 700, color: C.gold, textDecoration: 'none', borderBottom: `1px solid ${C.gold}44`, paddingBottom: 1 }}
            >
              {t.faq} ›
            </Link>
          </div>

          {/* Live counters — REAL aggregates from the pioneer stats endpoint (the
              authoritative source of pioneer counts). Rendered only when the server
              responds; every value is real (shows 0 honestly, never a fake number). */}
          {showCounters && (
            <div style={{ marginTop: 18, border: `1px solid ${C.gold}22`, borderRadius: 14, background: C.surface, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderBottom: `1px solid ${C.gold}18` }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, boxShadow: `0 0 0 3px ${C.green}22`, display: 'inline-block' }} />
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, color: C.green, textTransform: 'uppercase' }}>{t.liveLabel}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {[
                  { n: serverStats.pioneers, label: t.statPioneers, color: C.gold },
                  { n: serverStats.completed, label: t.statCompleted, color: C.text },
                  { n: serverStats.claimed,  label: `${t.statFounding} / ${FOUNDING_CAP}`, color: C.purple },
                ].map((s, i) => (
                  <div key={i} style={{ padding: '14px 10px', textAlign: 'center', borderInlineStart: i > 0 ? `1px solid ${C.gold}14` : 'none' }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: s.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.n}</div>
                    <div style={{ fontSize: 10.5, color: C.subtext, marginTop: 5, letterSpacing: 0.2, lineHeight: 1.3 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </header>

        {/* Anchor target for the hero "Start the Pioneer Quest" CTA (scroll only). */}
        <div id="pioneer-quest" style={{ scrollMarginTop: 16 }} />

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
            {serverCompleted && (
              <p style={{ fontSize: 13, color: C.green, margin: '12px 0 0', fontWeight: 700, lineHeight: 1.5 }}>{t.questDoneBanner(total)}</p>
            )}
          </section>
        ) : !authLoading ? (
          <section style={{ ...card, marginTop: 22, background: `${C.gold}12`, borderColor: `${C.gold}44` }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.gold }}>🔐 {t.questTitle}</div>
            <p style={{ fontSize: 13, color: C.text, margin: '8px 0 0', lineHeight: 1.7 }}>{t.questGate}</p>
          </section>
        ) : null}

        {/* Pi Browser + KYC callout */}
        <div style={{ ...card, marginTop: 16, background: `${C.gold}14`, borderColor: `${C.gold}44`, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>📱</span>
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
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{t.appsTitle(liveCount)}</h2>
            <span style={{ fontSize: 11, color: C.green, border: `1px solid ${C.green}55`, borderRadius: 999, padding: '2px 10px', fontWeight: 700 }}>{liveCount} live</span>
          </div>
          <p style={{ fontSize: 13, color: C.subtext, margin: '6px 0 14px', lineHeight: 1.6 }}>{t.appsLead}</p>

          {/* The gate card above says this too, but it is a long way from the
              thing being tapped. Somebody can work through a dozen apps before
              discovering none of it was kept. */}
          {!eligible && !authLoading && (
            <p style={{
              fontSize: 12.5, color: C.gold, lineHeight: 1.6, margin: '0 0 14px',
              background: `${C.gold}12`, border: `1px solid ${C.gold}44`,
              borderRadius: 12, padding: '10px 12px', fontWeight: 600,
            }}>
              {t.appsSignedOut}
            </p>
          )}

          <div style={{ display: 'grid', gap: 10 }}>
            {LIVE_DOMAINS.map((d) => {
              const isDone = eligible && visited.includes(d.slug);
              const raw    = linkFor(d.slug, d.route);
              const ext    = isExternal(raw);
              const href   = ext ? withQuestMark(raw) : raw;
              return (
                <a
                  key={d.slug}
                  data-app={d.slug}
                  href={href}
                  {...linkPropsFor(d.slug, ext)}
                  // The tick now lands while the page is still on screen. With a
                  // same-tab jump this POST raced the navigation away from it.
                  onClick={() => markVisited(d.slug)}
                  style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', borderColor: isDone ? `${C.green}55` : `${C.gold}22` }}
                >
                  <span style={{ fontSize: 24, lineHeight: 1, flex: '0 0 auto' }}>{d.emoji}</span>
                  <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: C.text }}>{d.name[locale]}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: C.subtext, marginTop: 2, lineHeight: 1.5 }}>{(d.valueProp ?? d.description)[locale]}</span>
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
            <>
              <div style={{ fontSize: 13, color: C.green, marginTop: 10, fontWeight: 800 }}>{t.youAreFounding(foundingNumber)}</div>
              {/* The page now promises 6 months of PRO. Somebody who has just
                  earned it should not have to go looking for where it lives —
                  and must not be sent there before it exists. */}
              {foundingGift === 'pending' ? (
                <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: C.subtext, lineHeight: 1.6 }}>
                  {t.proPending}
                </div>
              ) : (
              <Link
                href="/hub/subscription"
                style={{
                  display: 'inline-block', marginTop: 10, fontSize: 13, fontWeight: 800,
                  color: C.gold, textDecoration: 'none',
                  borderBottom: `1px solid ${C.gold}55`, paddingBottom: 1,
                }}
              >
                {t.seePro}
              </Link>
              )}
            </>
          )}
          {/* Shown to EVERYONE, not gated on `kyc_verified`.
              That flag is TEC's own KYC register; Pi's requirement is about Pi's,
              which this app cannot read. Firing the note off the wrong register
              told a Pi-verified visitor they were unverified — and hid the
              condition entirely from someone who had not logged in yet, which is
              exactly when a person decides whether the Quest is worth starting. */}
          {foundingNumber == null && (
            <div style={{ fontSize: 12.5, color: C.gold, marginTop: 10, fontWeight: 700, lineHeight: 1.5 }}>✅ {t.openToAll(total)}</div>
          )}
          <div style={{ fontSize: 11, color: C.subtext, marginTop: 10, fontWeight: 700, letterSpacing: 0.3 }}>
            {showCounters && serverStats ? t.foundingLive(serverStats.claimed, serverStats.remaining) : `${t.founding} · ${FOUNDING_CAP}`}
          </div>
        </section>

        <p style={{ fontSize: 12, color: C.subtext, margin: '28px 0 0', lineHeight: 1.7, textAlign: 'center' }}>{t.footer}</p>
      </div>
    </main>
  );
}
