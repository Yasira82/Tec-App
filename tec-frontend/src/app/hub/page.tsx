'use client';

import { LIVE_DOMAINS, COMING_SOON, getVisibleDomains } from '@/domains/_registry';
import { useEffect, useState, useCallback, useRef }      from 'react';
import { useRouter }                                      from 'next/navigation';
import { usePiAuth }                                      from '@/lib-client/hooks/usePiAuth';
import { usePiSdkReady }                                  from '@/lib-client/hooks/usePiSdkReady';
import { getAccessToken }                                 from '@/lib-client/pi/pi-auth';
import { piSession }                                      from '@/lib-client/pi/pi-session';
import { createU2APayment }                               from '@/lib-client/pi/pi-payment';
import { useRealtimeNotifications }                       from '@/lib-client/hooks/useRealtimeNotifications';
import { ErrorBoundary }                                  from '@/components/ErrorBoundary';
import { ToastContainer, Toast }                          from './components/ToastContainer';
import { AIDrawer }                                       from './components/AIDrawer';
import { AmountSelector }                                 from './components/AmountSelector';
import { HubSkeleton }                                    from './components/HubSkeleton';
import { PullIndicator }                                  from './components/PullIndicator';
import { PaymentModal, ExternalPayment }                  from './components/PaymentModal';

const ASSETS_URL   = 'https://assets.tecosystem.app';
const COMMERCE_URL = 'https://commerce.tecosystem.app';

const haptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate({ light: 10, medium: 25, heavy: 50 }[type]);
  }
};

function HubPageInner() {
  const { user, isAuthenticated, isLoading } = usePiAuth();
  const { piReady, authReady, ensurePiAuth } = usePiSdkReady();
  const router = useRouter();

  const userPro = !!user?.subscriptionPlan && user.subscriptionPlan !== 'Free';
  const userKyc = (user as { kycVerified?: boolean } | null)?.kycVerified ?? false;

  const visibleLive = getVisibleDomains(userKyc, userPro)
    .filter(d => d.status === 'live' && d.layer !== 'os')
    .map(d => ({ name: d.name.en, emoji: d.emoji, href: d.route ?? `/${d.slug}`, desc: d.description.en, slug: d.slug }));

  const [balance,         setBalance]         = useState('—');
  const [assetCount,      setAssetCount]      = useState<number | null>(null);
  const [time,            setTime]            = useState('');
  const [notifCount,      setNotifCount]      = useState(0);
  const [carouselIdx,     setCarouselIdx]     = useState(0);
  const [aiOpen,          setAiOpen]          = useState(false);
  const [piPrice,         setPiPrice]         = useState<{ price: number; change24h: number; high24h: number; low24h: number } | null>(null);
  const [toasts,          setToasts]          = useState<Toast[]>([]);
  const [pullProgress,    setPullProgress]    = useState(0);
  const [isRefreshing,    setIsRefreshing]    = useState(false);
  const [payAmount,       setPayAmount]       = useState(1);
  const [externalPayment, setExternalPayment] = useState<ExternalPayment | null>(null);

  const pullStartY     = useRef(0);
  const isPulling      = useRef(false);
  const touchStartX    = useRef(0);
  const touchEndX      = useRef(0);
  const PULL_THRESHOLD = 80;

  const showToast = useCallback((type: Toast['type'], message: string, txid?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message, txid }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const refreshBalance = useCallback(() => {
    if (!user?.id) return Promise.resolve();
    return fetch(`/api/wallet/balance?userId=${user.id}`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setBalance(`${Number(d.balance).toFixed(2)}`))
      .catch(() => {});
  }, [user?.id]);

  const refreshAssets = useCallback(() => {
    if (!user?.id) return Promise.resolve();
    return fetch('/api/bff/assets/list', { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setAssetCount(d.count ?? d.data?.length ?? 0))
      .catch(() => {});
  }, [user?.id]);

  const refreshNotifCount = useCallback(() => {
    if (!user?.id) return Promise.resolve();
    return fetch(`/api/notifications/unread-count?userId=${user.id}`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setNotifCount(d.count ?? 0))
      .catch(() => {});
  }, [user?.id]);

  const refreshPrice = useCallback(async () => {
    try {
      const res  = await fetch('/api/market/pi-price', { cache: 'no-store' });
      const data = await res.json();
      if (!data.error) setPiPrice(data);
    } catch {}
  }, []);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('pay') === '1') {
      const amount = parseFloat(p.get('amount') ?? '0');
      if (amount > 0) {
        setExternalPayment({
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

  const handlePaymentSuccess = useCallback(async (txid: string, paymentId: string) => {
    if (!externalPayment) return;

    if (externalPayment.productId.startsWith('nft:')) {
      try {
        const nftMeta   = JSON.parse(atob(externalPayment.productId.slice(4)));
        const csrfToken = document.cookie.split('; ')
          .find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';

        await fetch('/api/assets/provision', {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
          body: JSON.stringify({
            slug:       `nft-${paymentId.slice(0, 8)}-${Date.now()}`,
            payment_id: paymentId,
            category:   'NFT',
            metadata:   { name: nftMeta.n, description: nftMeta.d ?? '', imageUrl: nftMeta.u, key: nftMeta.k ?? '', mimeType: nftMeta.m ?? 'image/jpeg', txid },
          }),
        });
      } catch { /* non-blocking */ }
    }

    setExternalPayment(null);
    const ret = new URL(externalPayment.returnUrl);
    ret.searchParams.set('payment_status', 'success');
    ret.searchParams.set('txid',           txid);
    ret.searchParams.set('payment_id',     paymentId);
    ret.searchParams.set('product_id',     externalPayment.productId);
    window.location.href = ret.toString();
  }, [externalPayment]);

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
      await Promise.all([refreshBalance(), refreshAssets(), refreshPrice(), refreshNotifCount()]);
      setIsRefreshing(false); showToast('info', 'Updated ✓');
    } else { setPullProgress(0); }
  };

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.targetTouches[0].clientX; };
  const handleTouchEnd   = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 40) { haptic('light'); setCarouselIdx(diff > 0 ? 1 : 0); }
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    tick(); const id = setInterval(tick, 60000); return () => clearInterval(id);
  }, []);

  useEffect(() => { refreshBalance(); refreshAssets(); }, [refreshBalance, refreshAssets]);

  useEffect(() => {
    refreshNotifCount();
    const id = setInterval(refreshNotifCount, 10000);
    return () => clearInterval(id);
  }, [refreshNotifCount]);

  useEffect(() => {
    refreshPrice();
    const id = setInterval(refreshPrice, 60000);
    return () => clearInterval(id);
  }, [refreshPrice]);

  useEffect(() => {
    if (!piPrice) return;
    const id = setInterval(() => setCarouselIdx(p => p === 0 ? 1 : 0), 5000);
    return () => clearInterval(id);
  }, [piPrice]);

  const { unread: wsUnread, clearUnread } = useRealtimeNotifications({
    userId: user?.id,
    token:  getAccessToken(),
    onWalletUpdate: () => setTimeout(refreshBalance, 500),
  });

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

  if (isLoading || !isAuthenticated) return <HubSkeleton />;

  const goToAssets   = () => { haptic('light'); window.location.href = '/api/auth/sso?target=' + encodeURIComponent(ASSETS_URL); };
  const goToCommerce = () => { haptic('light'); window.location.href = '/api/auth/sso?target=' + encodeURIComponent(COMMERCE_URL); };
  const totalNotif   = wsUnread > 0 ? wsUnread : notifCount;
  const priceUp      = (piPrice?.change24h ?? 0) >= 0;

  return (
    <div
      style={{ minHeight: '100vh', background: '#020205', color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif', paddingBottom: 88, overflowY: 'auto', overscrollBehavior: 'none' }}
      onTouchStart={handlePullStart}
      onTouchMove={handlePullMove}
      onTouchEnd={handlePullEnd}
    >
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%,100%{opacity:1}50%{opacity:0.35} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none} }
        @keyframes shimmer { 0%{background-position:-200% center}100%{background-position:200% center} }
        @keyframes glow    { 0%,100%{opacity:0.4}50%{opacity:0.8} }
        @keyframes float   { 0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)} }

        .hub-btn:active  { transform:scale(0.97);transition:transform 80ms ease; }
        .app-card:active { transform:scale(0.96);transition:transform 80ms ease; }
        .nav-btn:active  { transform:scale(0.9);transition:transform 80ms ease; }

        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
        input[type=number]{-moz-appearance:textfield}

        .skeleton {
          background:linear-gradient(90deg,#0d0d18 25%,#13131f 50%,#0d0d18 75%);
          background-size:200% 100%;
          animation:shimmer 1.6s ease-in-out infinite;
          border-radius:8px;
        }
      `}</style>

      {externalPayment && (
        <PaymentModal
          payment={externalPayment}
          onClose={() => { setExternalPayment(null); window.location.href = externalPayment.returnUrl; }}
          onSuccess={handlePaymentSuccess}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <PullIndicator progress={pullProgress} refreshing={isRefreshing} />
      <AIDrawer open={aiOpen} onClose={() => setAiOpen(false)} />

      {/* ── AI Button ─────────────────────────────── */}
      {!aiOpen && (
        <button
          onClick={() => { haptic('medium'); setAiOpen(true); }}
          style={{
            position: 'fixed', bottom: 100, right: 16, zIndex: 200,
            width: 48, height: 48, borderRadius: '50%',
            background: 'linear-gradient(135deg,#d4af37,#b8882a)',
            border: 'none', boxShadow: '0 4px 20px rgba(212,175,55,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, cursor: 'pointer',
            animation: 'float 3s ease-in-out infinite',
          }}>
          🤖
        </button>
      )}

      {/* ── Header ───────────────────────────────── */}
      <header style={{
        padding: '14px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(2,2,5,0.85)',
        backdropFilter: 'blur(24px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg,#d4af37,#b8882a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 13, color: '#0a0800',
            boxShadow: '0 2px 12px rgba(212,175,55,0.3)',
          }}>T</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#d4af37', letterSpacing: 1.5, lineHeight: 1 }}>TEC</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', letterSpacing: 2, lineHeight: 1.4 }}>ECOSYSTEM</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontVariantNumeric: 'tabular-nums' }}>{time}</span>

          {/* Notifications */}
          <button className="hub-btn"
            onClick={() => { haptic('light'); clearUnread(); setNotifCount(0); router.push('/dashboard/notifications'); }}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: totalNotif > 0 ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${totalNotif > 0 ? 'rgba(212,175,55,0.25)' : 'rgba(255,255,255,0.08)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 16, position: 'relative',
            }}>
            🔔
            {totalNotif > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                minWidth: 17, height: 17, borderRadius: 999,
                background: '#ef4444', border: '2px solid #020205',
                fontSize: 9, fontWeight: 800, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 3px', lineHeight: 1,
              }}>
                {totalNotif > 9 ? '9+' : totalNotif}
              </span>
            )}
          </button>

          {/* Avatar */}
          <button className="hub-btn"
            onClick={() => { haptic('light'); router.push('/dashboard'); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(212,175,55,0.08)',
              border: '1px solid rgba(212,175,55,0.2)',
              borderRadius: 12, padding: '5px 10px 5px 5px', cursor: 'pointer',
            }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'linear-gradient(135deg,#d4af37,#b8882a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: '#0a0800',
            }}>
              {user?.piUsername?.[0]?.toUpperCase()}
            </div>
            <span style={{ fontSize: 12, color: '#d4af37', fontWeight: 600 }}>
              @{user?.piUsername}
            </span>
          </button>
        </div>
      </header>

      {/* ── Wallet Card ──────────────────────────── */}
      <div style={{ padding: '20px 16px 0', animation: 'fadeUp 0.4s ease both' }}>
        <button className="hub-btn"
          onClick={() => { haptic('light'); router.push('/dashboard/wallet'); }}
          style={{
            width: '100%', borderRadius: 24, overflow: 'hidden',
            background: 'linear-gradient(135deg, #0f0c1e 0%, #0a1628 50%, #0c1a0e 100%)',
            border: '1px solid rgba(212,175,55,0.15)',
            padding: '24px', cursor: 'pointer', textAlign: 'left',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
            position: 'relative',
          }}>
          {/* Glow effect */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 24,
            background: 'radial-gradient(ellipse 80% 60% at 20% 50%, rgba(212,175,55,0.06) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12, fontWeight: 600 }}>
              PI WALLET BALANCE
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
              {balance === '—' ? (
                <div className="skeleton" style={{ width: 120, height: 44 }} />
              ) : (
                <>
                  <span style={{ fontSize: 42, fontWeight: 900, color: '#d4af37', letterSpacing: -2, lineHeight: 1 }}>
                    {balance}
                  </span>
                  <span style={{ fontSize: 22, color: 'rgba(212,175,55,0.6)', fontWeight: 300 }}>π</span>
                </>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5 }}>View transactions →</span>
              </div>
              {piPrice && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: priceUp ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                  border: `1px solid ${priceUp ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  borderRadius: 999, padding: '3px 10px',
                }}>
                  <span style={{ fontSize: 10, color: priceUp ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                    {priceUp ? '▲' : '▼'} {Math.abs(piPrice.change24h).toFixed(2)}%
                  </span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>${piPrice.price.toFixed(4)}</span>
                </div>
              )}
            </div>
          </div>
        </button>
      </div>

      {/* ── Carousel ─────────────────────────────── */}
      <div style={{ padding: '14px 16px 0', animation: 'fadeUp 0.5s ease both' }}>
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ overflow: 'hidden', borderRadius: 20 }}>
          <div style={{ display: 'flex', transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1)', transform: `translateX(-${carouselIdx * 100}%)` }}>

            {/* Assets */}
            <div style={{ minWidth: '100%' }}>
              <button className="hub-btn" onClick={goToAssets}
                style={{
                  width: '100%', borderRadius: 20,
                  background: '#0d0d18', border: '1px solid rgba(212,175,55,0.12)',
                  padding: '16px 20px', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 16,
                    background: 'linear-gradient(135deg,#1a1208,#0d0d18)',
                    border: '1px solid rgba(212,175,55,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                  }}>💎</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 3 }}>Digital Assets</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.3 }}>Domains · NFTs · Real Estate</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {assetCount === null ? (
                    <div className="skeleton" style={{ width: 36, height: 32, marginBottom: 4 }} />
                  ) : (
                    <div style={{ fontSize: 30, fontWeight: 900, color: '#d4af37', lineHeight: 1 }}>{assetCount}</div>
                  )}
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', letterSpacing: 1.5, marginTop: 4 }}>ASSETS →</div>
                </div>
              </button>
            </div>

            {/* Commerce */}
            <div style={{ minWidth: '100%' }}>
              <button className="hub-btn" onClick={goToCommerce}
                style={{
                  width: '100%', borderRadius: 20,
                  background: '#0d0d18', border: '1px solid rgba(59,130,246,0.15)',
                  padding: '16px 20px', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 16,
                    background: 'linear-gradient(135deg,#0a1628,#0d0d18)',
                    border: '1px solid rgba(59,130,246,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                  }}>🛒</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 3 }}>Commerce</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.3 }}>Buy · Sell · Trade on Pi</div>
                  </div>
                </div>
                <div style={{ fontSize: 9, color: 'rgba(59,130,246,0.8)', letterSpacing: 1.5 }}>OPEN →</div>
              </button>
            </div>

            {/* Pi Price */}
            <div style={{ minWidth: '100%' }}>
              <div style={{
                borderRadius: 20, background: '#0d0d18',
                border: '1px solid rgba(212,175,55,0.12)', padding: '16px 20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 16,
                      background: 'linear-gradient(135deg,#1a1208,#0d0d18)',
                      border: '1px solid rgba(212,175,55,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, fontWeight: 900, color: '#d4af37',
                    }}>π</div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Pi Network</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>PI/USDT · OKX</div>
                    </div>
                  </div>
                  {piPrice ? (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 24, fontWeight: 900, color: '#d4af37' }}>${piPrice.price.toFixed(4)}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: priceUp ? '#10b981' : '#ef4444' }}>
                        {priceUp ? '▲' : '▼'} {Math.abs(piPrice.change24h).toFixed(2)}%
                      </div>
                    </div>
                  ) : <div className="skeleton" style={{ width: 80, height: 40 }} />}
                </div>
                {piPrice ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: '24H HIGH', value: `$${piPrice.high24h.toFixed(4)}`, color: '#10b981' },
                      { label: '24H LOW',  value: `$${piPrice.low24h.toFixed(4)}`,  color: '#ef4444' },
                    ].map(s => (
                      <div key={s.label} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5, marginBottom: 4 }}>{s.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div className="skeleton" style={{ height: 48 }} /> <div className="skeleton" style={{ height: 48 }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 10 }}>
          {[0, 1, 2].map(i => (
            <button key={i} onClick={() => { haptic('light'); setCarouselIdx(i); }}
              style={{
                width: carouselIdx === i ? 20 : 6, height: 6, borderRadius: 3,
                background: carouselIdx === i ? '#d4af37' : 'rgba(255,255,255,0.15)',
                border: 'none', cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)', padding: 0,
              }} />
          ))}
        </div>
      </div>

      {/* ── Pay Section ──────────────────────────── */}
      <div style={{ padding: '16px 16px 0', animation: 'fadeUp 0.55s ease both' }}>
        <AmountSelector value={payAmount} onChange={setPayAmount} disabled={!piReady} />
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          {/* Pay */}
          <button className="hub-btn" onClick={handlePay} disabled={!piReady}
            style={{
              flex: 1, padding: '15px 12px', borderRadius: 18,
              background: piReady
                ? 'linear-gradient(135deg,#0a2218,#06180e)'
                : 'rgba(255,255,255,0.04)',
              border: `1px solid ${piReady ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}`,
              color: piReady ? '#10b981' : 'rgba(255,255,255,0.2)',
              fontWeight: 700, fontSize: 13,
              cursor: piReady ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s ease',
              boxShadow: piReady ? '0 0 20px rgba(16,185,129,0.1)' : 'none',
            }}>
            {!piReady ? (
              <><div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'rgba(255,255,255,0.3)', animation: 'spin 0.8s linear infinite' }} /><span>Connecting…</span></>
            ) : (
              <><span style={{ fontFamily: 'Georgia,serif', fontSize: 17 }}>π</span><span>Pay {payAmount}π</span></>
            )}
          </button>

          {/* Receive */}
          <button className="hub-btn" onClick={() => { haptic('light'); router.push('/dashboard/wallet'); }}
            style={{
              flex: 1, padding: '15px 12px', borderRadius: 18,
              background: 'linear-gradient(135deg,#0a1628,#060f1e)',
              border: '1px solid rgba(59,130,246,0.25)',
              color: '#3b82f6', fontWeight: 700, fontSize: 13,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 0 20px rgba(59,130,246,0.08)',
            }}>
            <span style={{ fontFamily: 'Georgia,serif', fontSize: 17 }}>π</span>
            <span>Receive π</span>
          </button>
        </div>
      </div>

      {/* ── Live Apps ─────────────────────────────── */}
      <div style={{ padding: '24px 16px 0', animation: 'fadeUp 0.6s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: 2, textTransform: 'uppercase' }}>Live Now</span>
          </div>
          <span style={{
            fontSize: 10, color: '#10b981',
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.2)',
            padding: '3px 10px', borderRadius: 999, letterSpacing: 1,
          }}>
            {visibleLive.length} ACTIVE
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
          {visibleLive.map((app, idx) => (
            <button key={app.slug} className="app-card"
              onClick={() => { haptic('light'); router.push(app.href); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px',
                background: '#0d0d18',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 18, cursor: 'pointer', textAlign: 'left',
                animation: `fadeUp ${0.3 + idx * 0.05}s ease both`,
                transition: 'border-color 0.2s ease, background 0.2s ease',
              }}>
              <div style={{
                width: 42, height: 42, borderRadius: 14,
                background: 'rgba(212,175,55,0.08)',
                border: '1px solid rgba(212,175,55,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, minWidth: 42,
              }}>
                {app.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {app.name}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>{app.desc}</div>
              </div>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', minWidth: 6, animation: 'pulse 2s infinite' }} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Coming Soon ───────────────────────────── */}
      <div style={{ padding: '24px 16px 0', animation: 'fadeUp 0.65s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: 2, textTransform: 'uppercase' }}>Coming Soon</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: 1 }}>24 APPS</span>
        </div>
        {([
          { group: 'finance',      label: '💰 Finance',    color: '#d4af37' },
          { group: 'commerce',     label: '🛒 Commerce',   color: '#7eb8f7' },
          { group: 'real_world',   label: '🏙️ Real World', color: '#10b981' },
          { group: 'social',       label: '🌍 Social',     color: '#8b5cf6' },
          { group: 'tech',         label: '⚡ Tech',       color: '#f59e0b' },
          { group: 'monetization', label: '🏆 Membership', color: '#d4af37' },
        ] as const).map(({ group, label, color }) => {
          const apps = COMING_SOON.filter(d => d.group === group);
          if (!apps.length) return null;
          return (
            <div key={group} style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 9, color: `${color}60`, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>{label}</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 8 }}>
                {apps.map(app => (
                  <div key={app.slug} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    padding: '12px 6px',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: 14, opacity: 0.5,
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <span style={{ fontSize: 20 }}>{app.emoji}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>{app.name.en}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Bottom Nav ────────────────────────────── */}
      <nav style={{
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
          <button key={item.label} className="nav-btn" onClick={item.action}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 4, background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px 0', position: 'relative',
            }}>
            {item.active && (
              <span style={{
                position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
                width: 24, height: 3, borderRadius: 999,
                background: 'linear-gradient(90deg,#d4af37,#b8882a)',
                boxShadow: '0 0 8px rgba(212,175,55,0.6)',
              }} />
            )}
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{
              fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: item.active ? 700 : 400,
              color: item.active ? '#d4af37' : 'rgba(255,255,255,0.28)',
            }}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function HubPage() {
  return <ErrorBoundary><HubPageInner /></ErrorBoundary>;
      }
