'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter }                                 from 'next/navigation';
import { usePiAuth }                                 from '@/lib-client/hooks/usePiAuth';
import { usePiSdkReady }                             from '@/lib-client/hooks/usePiSdkReady';
import { piSession }                                 from '@/lib-client/pi/pi-session';
import { createU2APayment }                          from '@/lib-client/pi/pi-payment';
import { useRealtimeNotifications }                  from '@/lib-client/hooks/useRealtimeNotifications';
import { getAccessToken }                            from '@/lib-client/pi/pi-auth';
import { getVisibleDomains }                         from '@/domains/_registry';
import { ErrorBoundary }                             from '@/components/ErrorBoundary';
import { ToastContainer, Toast }                     from './components/ToastContainer';
import { AIDrawer }                                  from './components/AIDrawer';
import { HubSkeleton }                               from './components/HubSkeleton';
import { PullIndicator }                             from './components/PullIndicator';
import { PaymentModal, ExternalPayment }             from './components/PaymentModal';
import {
  HubHeader,
  HubWalletCard,
  HubCarousel,
  HubPayActions,
  HubAppsGrid,
  HubComingSoon,
} from '@/components/hub';
import { useHubData }  from '@/hooks/useHubData';
import { haptic }      from '@/lib/hub/utils';
import '@/styles/tec-design-tokens.css';

const ASSETS_URL     = 'https://assets.tecosystem.app';
const COMMERCE_URL   = 'https://commerce.tecosystem.app';
const PULL_THRESHOLD = 80;

function HubPageInner() {
  const { user, isAuthenticated, isLoading } = usePiAuth();
  const { piReady, authReady, ensurePiAuth } = usePiSdkReady();
  const router = useRouter();

  const userPro = !!user?.subscriptionPlan && user.subscriptionPlan !== 'Free';
  const userKyc = (user as { kycVerified?: boolean } | null)?.kycVerified ?? false;

  const visibleLive = getVisibleDomains(userKyc, userPro)
    .filter(d => d.status === 'live' && d.layer !== 'os')
    .map(d => ({ slug: d.slug, name: d.name.en, emoji: d.emoji, href: d.route ?? `/${d.slug}`, desc: d.description.en }));

  const { balance, assetCount, piPrice, notifCount, time, setNotifCount, refresh, refreshBalance } =
    useHubData(user?.id);

  const [carouselIdx,     setCarouselIdx]     = useState(0);
  const [aiOpen,          setAiOpen]          = useState(false);
  const [toasts,          setToasts]          = useState<Toast[]>([]);
  const [pullProgress,    setPullProgress]    = useState(0);
  const [isRefreshing,    setIsRefreshing]    = useState(false);
  const [payAmount,       setPayAmount]       = useState(1);
  const [externalPayment, setExternalPayment] = useState<ExternalPayment | null>(null);
  const [pendingPayment,  setPendingPayment]  = useState<ExternalPayment | null>(null);

  const pullStartY = useRef(0);
  const isPulling  = useRef(false);

  const showToast = useCallback((type: Toast['type'], message: string, txid?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message, txid }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  /* ── Step 1: قرا الـ URL params فوراً ──────────────── */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('pay') === '1') {
      const amount = parseFloat(p.get('amount') ?? '0');
      if (amount > 0) {
        setPendingPayment({
          amount,
          memo:      decodeURIComponent(p.get('memo')       ?? 'TEC Payment'),
          productId: p.get('product_id') ?? '',
          returnUrl: decodeURIComponent(p.get('return_url') ?? COMMERCE_URL),
          source:    p.get('source')     ?? 'commerce',
        });
        window.history.replaceState({}, '', '/hub');
      }
    }
  }, []);

  /* ── Step 2: لما piReady + authReady → اعرض Modal ──── */
  useEffect(() => {
    if (piReady && authReady && pendingPayment && !externalPayment) {
      setExternalPayment(pendingPayment);
      setPendingPayment(null);
    }
  }, [piReady, authReady, pendingPayment, externalPayment]);

  const handlePaymentSuccess = useCallback(async (txid: string, paymentId: string) => {
    if (!externalPayment) return;
    if (externalPayment.productId.startsWith('nft:')) {
      try {
        const nftMeta   = JSON.parse(atob(externalPayment.productId.slice(4)));
        const csrfToken = document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
        await fetch('/api/assets/provision', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
          body: JSON.stringify({
            slug:       `nft-${paymentId.slice(0,8)}-${Date.now()}`,
            payment_id: paymentId,
            category:   'NFT',
            metadata:   { name: nftMeta.n, description: nftMeta.d ?? '', imageUrl: nftMeta.u, txid },
          }),
        });
      } catch {}
    }
    setExternalPayment(null);
    const ret = new URL(externalPayment.returnUrl);
    ret.searchParams.set('payment_status', 'success');
    ret.searchParams.set('txid',           txid);
    ret.searchParams.set('payment_id',     paymentId);
    ret.searchParams.set('product_id',     externalPayment.productId);
    window.location.href = ret.toString();
  }, [externalPayment]);

  /* ── Pull to refresh ───────────────────────────────── */
  const handlePullStart = (e: React.TouchEvent) => {
    const el = e.currentTarget as HTMLElement;
    if (el.scrollTop === 0) { pullStartY.current = e.touches[0].clientY; isPulling.current = true; }
  };
  const handlePullMove = (e: React.TouchEvent) => {
    if (!isPulling.current) return;
    const diff = e.touches[0].clientY - pullStartY.current;
    if (diff > 0) setPullProgress(Math.min(diff / PULL_THRESHOLD, 1));
  };
  const handlePullEnd = async () => {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullProgress >= 1) {
      haptic('medium'); setIsRefreshing(true); setPullProgress(0);
      await refresh();
      setIsRefreshing(false); showToast('info', 'Updated ✓');
    } else { setPullProgress(0); }
  };

  /* ── Carousel ──────────────────────────────────────── */
  useEffect(() => {
    if (!piPrice) return;
    const id = setInterval(() => setCarouselIdx(p => p === 2 ? 0 : p + 1), 5000);
    return () => clearInterval(id);
  }, [piPrice]);

  /* ── Auth guard ✅ مش بيطرد لو فيه pending payment ── */
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !pendingPayment) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, pendingPayment, router]);

  /* ── Realtime ──────────────────────────────────────── */
  const { unread: wsUnread, clearUnread } = useRealtimeNotifications({
    userId: user?.id, token: getAccessToken(),
    onWalletUpdate: () => setTimeout(refreshBalance, 500),
  });

  /* ── Pay ───────────────────────────────────────────── */
  const handlePay = useCallback(async () => {
    sessionStorage.removeItem('post_pi_redirect');
    if (!window.Pi) { haptic('heavy'); showToast('error', 'Open in Pi Browser'); return; }
    if (!piReady)   { haptic('heavy'); showToast('warning', 'Pi SDK connecting...'); return; }
    if (!payAmount || payAmount <= 0) { haptic('heavy'); showToast('warning', 'Enter a valid amount'); return; }
    const locked = await piSession.acquirePaymentLock();
    if (!locked) { showToast('warning', 'Payment in progress'); return; }
    haptic('medium');
    try {
      if (!authReady) await ensurePiAuth();
      const result = await createU2APayment(payAmount, `TEC Payment — ${payAmount}π`, { source: 'hub', amount: payAmount });
      if (result.success && result.status === 'completed') {
        haptic('heavy'); showToast('success', `${payAmount}π paid! 🎉`, result.txid);
        setTimeout(refreshBalance, 2000);
      } else if (result.status === 'cancelled') {
        haptic('light'); showToast('warning', 'Payment cancelled');
      } else {
        haptic('heavy'); showToast('error', result.message ?? 'Payment failed');
      }
    } catch (err) {
      haptic('heavy');
      const msg = err instanceof Error ? err.message : 'Payment failed';
      if (msg.includes('not initialized')) { window.location.reload(); return; }
      showToast('error', msg);
    } finally {
      piSession.releasePaymentLock();
      refreshBalance();
    }
  }, [piReady, authReady, ensurePiAuth, payAmount, refreshBalance, showToast]);

  /* ── ✅ لو مش authenticated وفيه pending payment → loading */
  if (isLoading || (!isAuthenticated && !pendingPayment)) return <HubSkeleton />;

  /* ── ✅ لو جاي للدفع وبس → وريه payment loading screen */
  if (!isAuthenticated && pendingPayment) return (
    <div style={{ minHeight: '100vh', background: '#020205', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg,#d4af37,#b8882a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: '#0a0800' }}>T</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(212,175,55,0.2)', borderTopColor: '#d4af37', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: 13, color: '#4a4a5a' }}>Preparing payment...</span>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {externalPayment && (
        <PaymentModal
          payment={externalPayment}
          onClose={() => { setExternalPayment(null); window.location.href = externalPayment.returnUrl; }}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );

  const totalNotif   = wsUnread > 0 ? wsUnread : notifCount;
  const goToAssets   = () => { haptic('light'); window.location.href = '/api/auth/sso?target=' + encodeURIComponent(ASSETS_URL); };
  const goToCommerce = () => { haptic('light'); window.location.href = '/api/auth/sso?target=' + encodeURIComponent(COMMERCE_URL); };

  return (
    <div
      style={{ minHeight: '100vh', background: '#020205', color: '#fff', fontFamily: 'var(--font-sans)', paddingBottom: 88, overflowY: 'auto', overscrollBehavior: 'none' }}
      onTouchStart={handlePullStart}
      onTouchMove={handlePullMove}
      onTouchEnd={handlePullEnd}
    >
      {externalPayment && (
        <PaymentModal
          payment={externalPayment}
          onClose={() => { setExternalPayment(null); window.location.href = externalPayment.returnUrl; }}
          onSuccess={handlePaymentSuccess}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={id => setToasts(p => p.filter(t => t.id !== id))} />
      <PullIndicator progress={pullProgress} refreshing={isRefreshing} />
      <AIDrawer open={aiOpen} onClose={() => setAiOpen(false)} />

      {!aiOpen && (
        <button className="tec-float tec-btn"
          onClick={() => { haptic('medium'); setAiOpen(true); }}
          aria-label="Open AI assistant"
          style={{
            position: 'fixed', bottom: 100, right: 16, zIndex: 200,
            width: 48, height: 48, borderRadius: '50%',
            background: 'linear-gradient(135deg,#d4af37,#b8882a)',
            border: 'none', boxShadow: '0 4px 20px rgba(212,175,55,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, cursor: 'pointer',
          }}>🤖</button>
      )}

      <HubHeader
        piUsername={user?.piUsername ?? ''}
        time={time}
        notifCount={totalNotif}
        onNotifClick={() => { haptic('light'); clearUnread(); setNotifCount(0); router.push('/dashboard/notifications'); }}
      />
      <HubWalletCard balance={balance} piPrice={piPrice} />
      <HubCarousel
        carouselIdx={carouselIdx}
        setCarouselIdx={setCarouselIdx}
        assetCount={assetCount}
        piPrice={piPrice}
        goToAssets={goToAssets}
        goToCommerce={goToCommerce}
      />
      <HubPayActions
        payAmount={payAmount}
        setPayAmount={setPayAmount}
        piReady={piReady}
        onPay={handlePay}
      />
      <HubAppsGrid apps={visibleLive} />
      <HubComingSoon />

      <nav aria-label="Main navigation"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'rgba(5,5,10,0.92)',
          backdropFilter: 'blur(24px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', padding: '10px 4px',
          paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
          zIndex: 150,
        }}>
        {[
          { icon: '⊞',  label: 'Hub',      active: true,  action: () => {} },
          { icon: '💳', label: 'Wallet',   active: false, action: () => { haptic('light'); router.push('/dashboard/wallet'); } },
          { icon: '💎', label: 'Assets',   active: false, action: goToAssets },
          { icon: '🛒', label: 'Commerce', active: false, action: goToCommerce },
          { icon: '⚙️', label: 'Settings', active: false, action: () => { haptic('light'); router.push('/dashboard'); } },
        ].map(item => (
          <button key={item.label} className="tec-nav-btn" onClick={item.action}
            aria-label={item.label}
            aria-current={item.active ? 'page' : undefined}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', position: 'relative' }}>
            {item.active && (
              <span style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', width: 24, height: 3, borderRadius: 999, background: 'linear-gradient(90deg,#d4af37,#b8882a)', boxShadow: '0 0 8px rgba(212,175,55,0.6)' }} />
            )}
            <span aria-hidden="true" style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{ fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: item.active ? 700 : 400, color: item.active ? '#d4af37' : 'rgba(255,255,255,0.28)' }}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function HubPage() {
  return <ErrorBoundary><HubPageInner /></ErrorBoundary>;
                                     }
