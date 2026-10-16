'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter }                        from 'next/navigation';
import { usePiAuth }                        from '@/lib-client/hooks/usePiAuth';
import { rememberReturn, clearReturn, takeOnward } from '@/lib-client/return-to';
import { usePiSdkReady }                    from '@/lib-client/hooks/usePiSdkReady';
import { useRealtimeNotifications }         from '@/lib-client/hooks/useRealtimeNotifications';
import { useExternalPayment }               from '@/lib-client/hooks/useExternalPayment';
import { LIVE_DOMAINS }                     from '@/domains/_registry';
import { routeForNetwork }                  from '@/domains/testnet-hosts';
import { t as tr, type Locale }             from '@/domains/_types';
import { ErrorBoundary }                    from '@/components/ErrorBoundary';
import { ToastContainer, Toast }            from './components/ToastContainer';
import { AIDrawer }                         from './components/AIDrawer';
import { HubSkeleton }                      from './components/HubSkeleton';
import { HubContinue }                      from './components/HubContinue';
import { PaymentModal }                     from './components/PaymentModal';
import { PaymentPreparing }                 from './components/PaymentPreparing';
import {
  HubHeader, HubWalletCard, HubCarousel,
  HubAppsGrid, HubComingSoon, HubBottomNav,
} from '@/components/hub';
import { useHubData }     from '@/hooks/useHubData';
import { useTranslation } from '@/lib/i18n';
import { haptic }         from '@/lib/hub/utils';
import { sessionToken }   from '@/lib-client/pi/session-source';
import { useHandoffLinks } from '@/lib-client/handoff-links';
import '@/styles/tec-design-tokens.css';

/**
 * No silent Pi sign-in on /hub: in Pi Browser, a /hub that finds no session
 * offers the tap at once (HubContinue), on the Hub, instead of leaving for the
 * marketing page. Read once, at mount.
 *
 * A grid app opens in a NEW tab — the only way Pi answers the app, counts the
 * visit as the app's, and lets it take a payment (owner, phone, 2026-10-02: in
 * the same tab, four payments from grid visits never reached approve while a
 * standalone one completed). Coming back from that tab, Pi Browser reloads the
 * Hub with none of its cookies (C-123 §7), and Pi does not answer a sign-in
 * nobody tapped: the silent attempt only ran out its budget and left for the
 * marketing page. The tap works at once — so it is offered first.
 *
 * Not on the Mode-1 pay screen (`?pay=1`): that path keeps the silent sign-in
 * its payment preparation waits on.
 */
const tapToContinue = (): boolean => {
  try {
    if (new URLSearchParams(window.location.search).get('pay') === '1') return false;
  } catch { /* ignore */ }
  return looksLikePiBrowser();
};

/**
 * Pi Browser, by its user agent — the same tokens `usePiBrowser` reads, plus
 * Android's in-app WebView marker (`; wv)`), which Pi Browser is and an ordinary
 * phone browser is not. Not `window.Pi`: the SDK script defines it in ANY
 * browser, and it may not have loaded yet at mount. A desktop browser keeps the
 * old behaviour (to "/"), where a Pi tap could never work anyway.
 */
const looksLikePiBrowser = (): boolean => {
  try {
    const ua = navigator.userAgent;
    return /PiBrowser|Pi Network|MinePI/i.test(ua) || (/Android/i.test(ua) && /;\s*wv\)/.test(ua));
  } catch { return false; }
};

function HubPageInner() {
  const [tapFirst] = useState(tapToContinue);
  // Once offered, the continue screen stays while its sign-in runs (login()
  // flips isLoading) — so a failure can still say so beside the button.
  const [offerContinue, setOfferContinue] = useState(false);
  // See tapToContinue: no silent Pi sign-in here; HubContinue offers the tap.
  const { user, isAuthenticated, isLoading, signingIn, login } = usePiAuth({ silentOnLoad: !tapFirst });
  const { t, dir } = useTranslation();
  const locale: Locale = dir === 'rtl' ? 'ar' : 'en';

  // Fire-and-forget backend warmup (Railway cold starts — see /api/warmup):
  // wake the gateway while auth resolves so wallet/apps data lands warm.
  useEffect(() => { fetch('/api/warmup').catch(() => {}); }, []);
  const { piReady } = usePiSdkReady();
  const router = useRouter();

  // LIVE NOW shows every live app: visibility is not authorization — KYC/role
  // gating stays enforced by each app and its services (P6). Filtering live
  // apps by the KYC flag made Assets/Commerce invisible to non-KYC users.
  //
  // External apps open STANDALONE, on their own domain — the way the campaign
  // opens them (C-123 §12), and for the same reason. They used to go through
  // `/api/auth/sso?target=…`: the app saw a Hub referrer, marked the tab
  // Hub-owned (ADR-007) and never signed the visitor in with Pi, so every grid
  // visit counted at Pi for the HUB, not the app, and every purchase bounced
  // back into the Hub's modal (Mode 1). Owner decision, 2026-10-02 — KB
  // audits/HUB_GRID_VISITS_NOT_COUNTED_2026-09-29.md.
  //
  // Now the Hub signs each app's link while the visitor is still here, and the
  // tile opens it with no referrer: the app arrives signed in, signs in with Pi
  // itself (the visit is the app's), and pays inside itself (Mode 2).
  const visibleLive = LIVE_DOMAINS
    .filter(d => d.layer !== 'os')
    .map(d => {
      // On the TESTNET Hub, open the app's TESTNET host. Every route in the
      // registry is a Mainnet domain, so this grid used to hand a Testnet
      // visitor to the Mainnet app — and from there the app correctly resolved
      // the Mainnet Hub, so the payment came back as a Mainnet payment that a
      // Test-Pi wallet can never pay. See domains/testnet-hosts.ts.
      const route  = routeForNetwork(d.route ?? `/${d.slug}`, d.slug);
      const appUrl = route.startsWith('http') ? route : undefined;
      // The registry already carries `name.ar` / `description.ar`; the Hub grid was
      // pinned to `.en`, so every tile stayed English on an otherwise Arabic screen.
      return {
        slug: d.slug, emoji: d.emoji, href: route, appUrl, group: d.group,
        name: tr(d.name, locale),
        desc: tr(d.valueProp ?? d.description, locale),
      };
    });

  // One signed link per app, minted while the visitor is here (C-123 §12). Not
  // during a Hub payment (`?pay=1`): that screen never shows the grid.
  const onPayScreen = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('pay') === '1';
  const signed = useHandoffLinks(
    visibleLive.flatMap((a) => (a.appUrl ? [a.appUrl] : [])),
    isAuthenticated && !onPayScreen,
  );
  const gridApps = visibleLive.map((a) => (a.appUrl ? { ...a, href: signed(a.appUrl) } : a));

  const { balance, balanceError, piPrice, notifCount, time, setNotifCount, refreshBalance } =
    useHubData(user?.id);

  const [carouselIdx, setCarouselIdx] = useState(0);
  const [aiOpen,      setAiOpen]      = useState(false);

  // Is a reward round open? The spotlight slide only exists while one is, so it
  // never advertises a campaign that has ended. Failure is treated as CLOSED —
  // the Hub must not headline Pi it cannot confirm is on offer (P6).
  //
  // Declared HERE, with the other hooks, and not beside `goToCampaign` further
  // down: two early returns sit between the two places (`HubSkeleton` and
  // `PaymentPreparing`), so a hook after them is called conditionally. React
  // says "Rendered fewer hooks than expected" and the whole page throws.
  const [campaignOpen, setCampaignOpen] = useState(false);
  useEffect(() => {
    // Skipped entirely during a Hub payment (`/hub?pay=1&…`). That path renders
    // PaymentPreparing and then the modal — the carousel never appears, so the
    // request is pure waste on the one screen where latency is most visible and
    // an extra round trip is most expensive.
    if (typeof window !== 'undefined'
        && new URLSearchParams(window.location.search).get('pay') === '1') return;
    let alive = true;
    fetch('/api/bff/campaign/status', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (alive) setCampaignOpen(j?.data?.open === true); })
      .catch(() => { /* closed */ });
    return () => { alive = false; };
  }, []);
  const [toasts,      setToasts]      = useState<Toast[]>([]);

  const showToast = useCallback((type: Toast['type'], message: string, txid?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message, txid }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const onPaymentInitFailed = useCallback(
    () => showToast('error', t.hub.payment.initFailed),
    [showToast, t.hub.payment.initFailed],
  );

  // Mode-1 handoff (`/hub?pay=1&…`): read the URL, create the record, open the modal.
  const { pending: pendingPayment, external: externalPayment, clearExternal } =
    useExternalPayment({ isLoading, piReady, user, onError: onPaymentInitFailed });

  const handlePaymentSuccess = useCallback(async (txid: string, paymentId: string) => {
    if (!externalPayment) return;
    clearExternal();
    const ret = new URL(externalPayment.returnUrl);
    ret.searchParams.set('payment_status', 'success');
    ret.searchParams.set('txid',           txid);
    ret.searchParams.set('payment_id',     paymentId);
    ret.searchParams.set('product_id',     externalPayment.productId);
    window.location.href = ret.toString();
  }, [externalPayment, clearExternal]);

  const closePaymentModal = useCallback(() => {
    if (!externalPayment) return;
    clearExternal();
    window.location.href = externalPayment.returnUrl;
  }, [externalPayment, clearExternal]);

  useEffect(() => {
    if (!piPrice) return;
    const id = setInterval(() => setCarouselIdx(p => p === 3 ? 0 : p + 1), 5000);
    return () => clearInterval(id);
  }, [piPrice]);

  /* ── Auth guard ── */
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !pendingPayment && !tapFirst) {
      // Remember the Hub before leaving it, so signing in returns here rather
      // than to the marketing page. Same reason as the dashboard guard.
      rememberReturn('/hub');
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, pendingPayment, tapFirst, router]);

  useEffect(() => {
    if (tapFirst && !isLoading && !isAuthenticated && !pendingPayment) setOfferContinue(true);
  }, [tapFirst, isLoading, isAuthenticated, pendingPayment]);

  /* ── Returning from an app: open the page it was tapped from, on top of the Hub ── */
  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    // Standing on the Hub signed in: any remembered destination is from a trip
    // that is over — see clearReturn.
    clearReturn();
    const onward = takeOnward();
    // Pushed, not replaced: the Hub stays underneath, so the next back lands here.
    if (onward && !pendingPayment) router.push(onward);
  }, [isLoading, isAuthenticated, pendingPayment, router]);

  const { unread: wsUnread, clearUnread } = useRealtimeNotifications({
    userId: user?.id, token: sessionToken(),
    onWalletUpdate: () => setTimeout(refreshBalance, 500),
  });

  /* ── Early returns ── */
  if (offerContinue && !isAuthenticated && !pendingPayment) {
    return <HubContinue onContinue={login} />;
  }
  if (isLoading || (!isAuthenticated && !pendingPayment)) {
    return <HubSkeleton message={signingIn ? t.hub.signingIn : undefined} />;
  }

  // A Mode-1 payment is still being prepared — show only the splash, not the whole
  // Hub. Covers both the signed-in case and the one where SSO is still resolving;
  // they rendered identical markup from two separate branches before.
  if (pendingPayment && !externalPayment) return <PaymentPreparing />;

  const totalNotif = wsUnread > 0 ? wsUnread : notifCount;
  // Marketing missions entry — the Pioneer Quest / Founding 100 (public route, same origin).
  const goToCampaign = () => { haptic('light'); router.push('/hub/campaign'); };
  const goToPioneers = () => { haptic('light'); router.push('/pioneers'); };
  const goToReferral = () => { haptic('light'); router.push('/hub/referral'); };

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? t.hub.greeting.morning
                 : hour < 18 ? t.hub.greeting.afternoon
                 : t.hub.greeting.evening;

  return (
    <div
      dir={dir}
      style={{ minHeight: '100vh', background: 'var(--tec-bg)', color: 'var(--tec-text-1)', fontFamily: 'var(--font-sans)',
        // Clears the fixed bottom nav. Nothing else hovers over the content any more.
        paddingBottom: 88 }}
    >
      {externalPayment && (
        <PaymentModal payment={externalPayment} onClose={closePaymentModal} onSuccess={handlePaymentSuccess} />
      )}

      <ToastContainer toasts={toasts} onDismiss={id => setToasts(p => p.filter(t => t.id !== id))} />
      <AIDrawer open={aiOpen} onClose={() => setAiOpen(false)} />

      <HubHeader
        piUsername={user?.piUsername ?? ''}
        time={time}
        notifCount={totalNotif}
        onNotifClick={() => { haptic('light'); clearUnread(); setNotifCount(0); router.push('/hub/notifications'); }}
      />

      {/* Personalized greeting — time-of-day + Pi username */}
      {user?.piUsername && (
        <div style={{ padding: '16px 20px 0', animation: 'tec-fade-in 0.35s ease both' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--tec-text-1)', letterSpacing: -0.2 }}>
            {/* The comma lives in the dictionary — Arabic writes ، not ,. And the
                handle is Latin inside an Arabic line, so it gets an explicit
                direction: bidi otherwise decides where the "@" lands. */}
            {greeting} <span dir="ltr" style={{ color: 'var(--tec-gold)' }}>@{user.piUsername}</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--tec-text-2)', marginTop: 3 }}>{t.hub.greeting.sub}</div>
        </div>
      )}

      <HubWalletCard balance={balance} piPrice={piPrice} balanceError={balanceError} onRetryBalance={refreshBalance} />

      {/* Carousel = the top spotlight: Founding-100 marketing missions + an app
          announcement + the live Pi price. */}
      <HubCarousel
        carouselIdx={carouselIdx}
        setCarouselIdx={setCarouselIdx}
        piPrice={piPrice}
        campaignOpen={campaignOpen}
        goToCampaign={goToCampaign}
        goToPioneers={goToPioneers}
        goToReferral={goToReferral}
      />

      <HubAppsGrid apps={gridApps} onOpenStandalone={(app) => {
        // Android's Back from the app's tab opens the Hub's ROOT — Pi Browser
        // goes back to the Hub app's own URL, `/`, not `/hub` (owner, phone,
        // 2026-10-02). `/` forwards a signed-in visitor to a remembered
        // destination; the campaign has always left one, the grid never did.
        rememberReturn('/hub');
        if (app.appUrl) signed.spent(app.appUrl);
      }} />
      <HubComingSoon />


      <HubBottomNav onOpenAi={() => setAiOpen(true)} />
    </div>
  );
}

export default function HubPage() {
  return <ErrorBoundary><HubPageInner /></ErrorBoundary>;
}
