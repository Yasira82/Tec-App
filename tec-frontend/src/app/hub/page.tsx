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
import '@/styles/tec-design-tokens.css';

function HubPageInner() {
  const { user, isAuthenticated, isLoading } = usePiAuth();
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
  // External apps are entered through Hub SSO so they land with a session.
  const visibleLive = LIVE_DOMAINS
    .filter(d => d.layer !== 'os')
    .map(d => {
      // On the TESTNET Hub, open the app's TESTNET host. Every route in the
      // registry is a Mainnet domain, so this grid used to hand a Testnet
      // visitor to the Mainnet app — and from there the app correctly resolved
      // the Mainnet Hub, so the payment came back as a Mainnet payment that a
      // Test-Pi wallet can never pay. See domains/testnet-hosts.ts.
      const route = routeForNetwork(d.route ?? `/${d.slug}`, d.slug);
      const href  = route.startsWith('http')
        ? `/api/auth/sso?target=${encodeURIComponent(route)}`
        : route;
      // The registry already carries `name.ar` / `description.ar`; the Hub grid was
      // pinned to `.en`, so every tile stayed English on an otherwise Arabic screen.
      return {
        slug: d.slug, emoji: d.emoji, href, group: d.group,
        name: tr(d.name, locale),
        desc: tr(d.valueProp ?? d.description, locale),
      };
    });

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
    if (!isLoading && !isAuthenticated && !pendingPayment) {
      // Remember the Hub before leaving it, so signing in returns here rather
      // than to the marketing page. Same reason as the dashboard guard.
      rememberReturn('/hub');
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, pendingPayment, router]);

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
  if (isLoading || (!isAuthenticated && !pendingPayment)) return <HubSkeleton />;

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

      <HubAppsGrid apps={visibleLive} />
      <HubComingSoon />


      <HubBottomNav onOpenAi={() => setAiOpen(true)} />
    </div>
  );
}

export default function HubPage() {
  return <ErrorBoundary><HubPageInner /></ErrorBoundary>;
}
