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

const ASSETS_URL   = 'https://assets.tecosystem.app';
const COMMERCE_URL = 'https://commerce.tecosystem.app';

const haptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    const patterns = { light: 10, medium: 25, heavy: 50 };
    navigator.vibrate(patterns[type]);
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

  const [balance,      setBalance]      = useState('—');
  const [assetCount,   setAssetCount]   = useState<number | null>(null);
  const [time,         setTime]         = useState('');
  const [notifCount,   setNotifCount]   = useState(0);
  const [carouselIdx,  setCarouselIdx]  = useState(0);
  const [aiOpen,       setAiOpen]       = useState(false);
  const [piPrice,      setPiPrice]      = useState<{ price: number; change24h: number; high24h: number; low24h: number } | null>(null);
  const [toasts,       setToasts]       = useState<Toast[]>([]);
  const [pullProgress, setPullProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [payAmount,    setPayAmount]    = useState(1);

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

  // ✅ بعد ما Pi SDK يكون ready → روح لـ hub/pay لو فيه redirect محفوظ

  
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);
useEffect(() => {
  if (!authReady || !isAuthenticated) return;  // ← السطر ده
  const redirect = sessionStorage.getItem('post_pi_redirect');
  if (redirect?.startsWith('/hub/pay')) {
    sessionStorage.removeItem('post_pi_redirect');
    window.location.href = redirect;
  }
}, [authReady, isAuthenticated]);
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
    if (!window.Pi) { haptic('heavy'); showToast('error', 'Open in Pi Browser to make payments'); return; }
    if (!piReady)   { haptic('heavy'); showToast('warning', 'Pi SDK connecting... try again'); return; }
    if (!payAmount || payAmount <= 0) { haptic('heavy'); showToast('warning', 'Enter a valid amount'); return; }

    const locked = await piSession.acquirePaymentLock();
    if (!locked) { showToast('warning', 'Payment already in progress'); return; }

    haptic('medium');
    try {
      if (!authReady) await ensurePiAuth();
      const result = await createU2APayment(payAmount, `TEC Payment — ${payAmount}π`, { source: 'hub', amount: payAmount, version: '1.0' });
      if (result.success && result.status === 'completed') {
        haptic('heavy'); showToast('success', `Payment of ${payAmount}π successful! 🎉`, result.txid);
        setTimeout(refreshBalance, 2000);
      } else if (result.status === 'cancelled') {
        haptic('light'); showToast('warning', 'Payment cancelled');
      } else {
        haptic('heavy'); showToast('error', result.message ?? 'Payment failed');
      }
    } catch (err) {
      haptic('heavy');
      const msg = err instanceof Error ? err.message : 'Payment failed';
      if (msg.includes('not initialized') || msg.includes('init')) { window.location.reload(); return; }
      if (/scope|permission|payments/i.test(msg)) { showToast('warning', 'Reconnecting to Pi payments... tap again'); return; }
      if (/pending|already have/i.test(msg)) { showToast('warning', 'Pending payment detected — try again'); }
      else { showToast('error', msg); }
    } finally {
      piSession.releasePaymentLock();
      refreshBalance();
    }
  }, [piReady, authReady, ensurePiAuth, payAmount, refreshBalance, showToast]);

  if (isLoading || !isAuthenticated) return <HubSkeleton />;

  const goToAssets   = () => { haptic('light'); window.location.href = '/api/auth/sso?target=' + encodeURIComponent(ASSETS_URL); };
  const goToCommerce = () => { haptic('light'); window.location.href = '/api/auth/sso?target=' + encodeURIComponent(COMMERCE_URL); };

  return (
    <div
      style={{ minHeight: '100vh', background: '#020205', color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif', paddingBottom: 90, overflowY: 'auto' }}
      onTouchStart={handlePullStart}
      onTouchMove={handlePullMove}
      onTouchEnd={handlePullEnd}
    >
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
        @keyframes toastIn { from { opacity:0; transform:translateY(-12px) scale(0.95); } to { opacity:1; transform:none; } }
        @keyframes shimmer { 0%,100% { opacity:0.4; } 50% { opacity:0.8; } }
        @keyframes aiPop   { from { opacity:0; transform:scale(0.8); } to { opacity:1; transform:scale(1); } }
        .hub-btn:active { transform: scale(0.97); }
        .app-btn:active  { transform: scale(0.95); }
        .fade-in { animation: slideUp 0.4s ease; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <PullIndicator progress={pullProgress} refreshing={isRefreshing} />
      <AIDrawer open={aiOpen} onClose={() => setAiOpen(false)} />

      {!aiOpen && (
        <button onClick={() => { haptic('medium'); setAiOpen(true); }}
          style={{ position: 'fixed', bottom: 90, right: 16, zIndex: 200, width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#d4af37,#b8882a)', border: '2px solid #d4af3740', boxShadow: '0 4px 20px rgba(212,175,55,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, cursor: 'pointer', animation: 'aiPop 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
          🤖
        </button>
      )}

      {/* ── Header ── */}
      <header style={{ padding: '14px 20px', borderBottom: '1px solid #ffffff08', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'rgba(2,2,5,0.95)', backdropFilter: 'blur(20px)', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#d4af37,#b8882a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, color: '#0a0800' }}>T</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#d4af37', letterSpacing: 1, lineHeight: 1 }}>TEC</div>
            <div style={{ fontSize: 9, color: '#4a4a5a', letterSpacing: 2, lineHeight: 1.2 }}>SUPER APP</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#4a4a5a', fontVariantNumeric: 'tabular-nums' }}>{time}</span>
          <button className="hub-btn"
            onClick={() => { haptic('light'); clearUnread(); setNotifCount(0); router.push('/dashboard/notifications'); }}
            style={{ width: 36, height: 36, borderRadius: 10, background: '#ffffff08', border: '1px solid #ffffff10', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, position: 'relative' }}>
            🔔
            {(wsUnread > 0 || notifCount > 0) && (
              <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#e74c3c', border: '2px solid #020205', fontSize: 9, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                {wsUnread > 0 ? wsUnread : notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>
          <button className="hub-btn" onClick={() => { haptic('light'); router.push('/dashboard'); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#d4af3710', border: '1px solid #d4af3725', borderRadius: 12, padding: '6px 10px', cursor: 'pointer' }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#d4af37,#b8882a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#0a0800' }}>
              {user?.piUsername?.[0]?.toUpperCase()}
            </div>
            <span style={{ fontSize: 12, color: '#d4af37', fontWeight: 600 }}>@{user?.piUsername}</span>
          </button>
        </div>
      </header>

      {/* ── Wallet Card ── */}
      <div style={{ padding: '16px 16px 0' }} className="fade-in">
        <button className="hub-btn" onClick={() => { haptic('light'); router.push('/dashboard/wallet'); }}
          style={{ width: '100%', borderRadius: 24, background: 'linear-gradient(135deg,#1a1208 0%,#0f0f1a 60%,#0a0f1f 100%)', border: '1px solid #d4af3725', padding: '22px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', transition: 'transform 0.2s ease' }}>
          <div>
            <div style={{ fontSize: 10, color: '#6b6b7a', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>PI WALLET BALANCE</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: '#d4af37', letterSpacing: -1, transition: 'all 0.3s ease' }}>{balance}</span>
              <span style={{ fontSize: 20, color: '#d4af3780' }}>π</span>
            </div>
            <div style={{ fontSize: 11, color: '#4a4a5a', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7ee7c0', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              View transactions →
            </div>
          </div>
          <div style={{ fontSize: 44, opacity: 0.15 }}>💳</div>
        </button>
      </div>

      {/* ── Carousel ── */}
      <div style={{ padding: '10px 16px 0' }} className="fade-in">
        <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} style={{ overflow: 'hidden', borderRadius: 18 }}>
          <div style={{ display: 'flex', transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)', transform: `translateX(-${carouselIdx * 100}%)` }}>

            {/* Slide 0: Assets */}
            <div style={{ minWidth: '100%' }}>
              <button className="hub-btn" onClick={goToAssets}
                style={{ width: '100%', borderRadius: 18, background: '#0d0d14', border: '1px solid #d4af3720', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,#1a1208,#0d0d14)', border: '1px solid #d4af3730', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>💎</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 3 }}>Digital Assets</div>
                    <div style={{ fontSize: 10, color: '#4a4a5a' }}>Domains · Real Estate · NFTs</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#d4af37', lineHeight: 1 }}>
                    {assetCount === null
                      ? <span style={{ display: 'inline-block', width: 32, height: 28, borderRadius: 6, background: '#ffffff10', animation: 'shimmer 1.4s infinite' }} />
                      : assetCount}
                  </div>
                  <div style={{ fontSize: 9, color: '#4a4a5a', letterSpacing: 1, marginTop: 3 }}>ASSETS →</div>
                </div>
              </button>
            </div>

            {/* Slide 1: Commerce */}
            <div style={{ minWidth: '100%' }}>
              <button className="hub-btn" onClick={goToCommerce}
                style={{ width: '100%', borderRadius: 18, background: '#0d0d14', border: '1px solid #7eb8f720', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,#0a1a2e,#0d0d14)', border: '1px solid #7eb8f730', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🛒</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 3 }}>Commerce</div>
                    <div style={{ fontSize: 10, color: '#4a4a5a' }}>Buy · Sell · Trade on Pi</div>
                  </div>
                </div>
                <div style={{ fontSize: 9, color: '#7eb8f7', letterSpacing: 1 }}>OPEN →</div>
              </button>
            </div>

            {/* Slide 2: Pi Price */}
            <div style={{ minWidth: '100%' }}>
              <div style={{ borderRadius: 18, background: '#0d0d14', border: '1px solid #d4af3720', padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,#1a1208,#0d0d14)', border: '1px solid #d4af3730', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>π</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Pi Network</div>
                      <div style={{ fontSize: 10, color: '#4a4a5a' }}>PI/USDT · OKX</div>
                    </div>
                  </div>
                  {piPrice ? (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#d4af37' }}>${piPrice.price.toFixed(4)}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: piPrice.change24h >= 0 ? '#7ee7c0' : '#e74c3c' }}>
                        {piPrice.change24h >= 0 ? '▲' : '▼'} {Math.abs(piPrice.change24h).toFixed(2)}%
                      </div>
                    </div>
                  ) : <div style={{ width: 80, height: 40, borderRadius: 8, background: '#ffffff08', animation: 'shimmer 1.4s infinite' }} />}
                </div>
                {piPrice ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ padding: '8px 12px', background: '#ffffff05', borderRadius: 10 }}>
                      <div style={{ fontSize: 10, color: '#4a4a5a', marginBottom: 2 }}>24H HIGH</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#7ee7c0' }}>${piPrice.high24h.toFixed(4)}</div>
                    </div>
                    <div style={{ padding: '8px 12px', background: '#ffffff05', borderRadius: 10 }}>
                      <div style={{ fontSize: 10, color: '#4a4a5a', marginBottom: 2 }}>24H LOW</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#e74c3c' }}>${piPrice.low24h.toFixed(4)}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ height: 48, borderRadius: 10, background: '#ffffff05', animation: 'shimmer 1.4s infinite' }} />
                    <div style={{ height: 48, borderRadius: 10, background: '#ffffff05', animation: 'shimmer 1.4s infinite' }} />
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8 }}>
          {[0,1,2].map(i => (
            <button key={i} onClick={() => { haptic('light'); setCarouselIdx(i); }}
              style={{ width: carouselIdx === i ? 16 : 6, height: 6, borderRadius: 3, background: carouselIdx === i ? '#d4af37' : '#ffffff20', border: 'none', cursor: 'pointer', transition: 'all 0.3s ease', padding: 0 }} />
          ))}
        </div>
      </div>

      {/* ── Amount Selector + Pay ── */}
      <div style={{ padding: '12px 16px 0' }} className="fade-in">
        <AmountSelector value={payAmount} onChange={setPayAmount} disabled={!piReady} />
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button className="hub-btn" onClick={handlePay} disabled={!piReady}
            style={{ flex: 1, padding: '16px 12px', borderRadius: 18, background: piReady ? 'linear-gradient(135deg,#0d2e14,#0a1f0f)' : '#0a0a0a', border: `1px solid ${piReady ? '#7ee7c040' : '#ffffff10'}`, color: piReady ? '#7ee7c0' : '#4a4a5a', fontWeight: 700, fontSize: 13, cursor: piReady ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: piReady ? 1 : 0.5, transition: 'all 0.3s' }}>
            {!piReady ? (
              <><div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #4a4a5a30', borderTop: '2px solid #4a4a5a', animation: 'spin 0.8s linear infinite' }} /><span>Connecting...</span></>
            ) : (
              <><span style={{ fontFamily: 'Georgia,serif', fontSize: 16 }}>π</span><span>Pay {payAmount}π</span></>
            )}
          </button>
          <button className="hub-btn" onClick={() => { haptic('light'); router.push('/dashboard/wallet'); }}
            style={{ flex: 1, padding: '16px 12px', borderRadius: 18, background: 'linear-gradient(135deg,#0a0f2e,#0a0f1f)', border: '1px solid #7eb8f740', color: '#7eb8f7', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'Georgia,serif', fontSize: 18 }}>π</span>
            <span>Receive π</span>
          </button>
        </div>
      </div>

      {/* ── Live Apps ── */}
      <div style={{ padding: '20px 16px 0' }} className="fade-in">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7ee7c0', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: 2, textTransform: 'uppercase' }}>Live Now</span>
          </div>
          <span style={{ fontSize: 10, color: '#7ee7c0', background: '#7ee7c008', border: '1px solid #7ee7c020', padding: '3px 10px', borderRadius: 20, letterSpacing: 1 }}>
            {visibleLive.length} ACTIVE
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          {visibleLive.map((app, idx) => (
            <button key={app.slug} className="app-btn"
              onClick={() => { haptic('light'); router.push(app.href); }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#0d0d14', border: '1px solid #d4af3720', borderRadius: 18, cursor: 'pointer', textAlign: 'left', animation: `slideUp ${0.3 + idx * 0.05}s ease` }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#d4af3710', border: '1px solid #d4af3720', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, minWidth: 40 }}>
                {app.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.name}</div>
                <div style={{ fontSize: 10, color: '#4a4a5a' }}>{app.desc}</div>
              </div>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7ee7c0', minWidth: 6, animation: 'pulse 2s infinite' }} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Coming Soon ── */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#4a4a5a', letterSpacing: 2, textTransform: 'uppercase' }}>Coming Soon</span>
          <span style={{ fontSize: 10, color: '#4a4a5a', letterSpacing: 1 }}>24 APPS</span>
        </div>
        {([
          { group: 'finance',      label: '💰 Finance',    style: { border: '1px solid #ffffff06', opacity: 0.45, color: '#6b6b7a' } },
          { group: 'commerce',     label: '🛒 Commerce',   style: { border: '1px solid #ffffff06', opacity: 0.45, color: '#6b6b7a' } },
          { group: 'real_world',   label: '🏙️ Real World', style: { border: '1px solid #ffffff06', opacity: 0.45, color: '#6b6b7a' } },
          { group: 'social',       label: '🌍 Social',     style: { border: '1px solid #ffffff06', opacity: 0.45, color: '#6b6b7a' } },
          { group: 'tech',         label: '⚡ Tech',       style: { border: '1px solid #ffffff06', opacity: 0.45, color: '#6b6b7a' } },
          { group: 'monetization', label: '🏆 Membership', style: { border: '1px solid #d4af3715', opacity: 0.6,  color: '#d4af3780' } },
        ] as const).map(({ group, label, style }) => {
          const apps = COMING_SOON.filter(d => d.group === group);
          if (!apps.length) return null;
          return (
            <div key={group} style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 9, color: '#d4af3760', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>{label}</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 8 }}>
                {apps.map(app => (
                  <div key={app.slug} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 6px', background: '#0d0d14', borderRadius: 14, opacity: style.opacity, border: style.border }}>
                    <span style={{ fontSize: 20 }}>{app.emoji}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, color: style.color, textAlign: 'center' }}>{app.name.en}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Bottom Nav ── */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(10,10,18,0.97)', backdropFilter: 'blur(20px)', borderTop: '1px solid #ffffff08', display: 'flex', padding: '10px 0 22px' }}>
        {[
          { icon: '⊞',  label: 'Hub',      active: true,  action: () => {} },
          { icon: '💳', label: 'Wallet',   active: false, action: () => { haptic('light'); router.push('/dashboard/wallet'); } },
          { icon: '💎', label: 'Assets',   active: false, action: goToAssets },
          { icon: '🛒', label: 'Commerce', active: false, action: goToCommerce },
          { icon: '⚙️', label: 'Settings', active: false, action: () => { haptic('light'); router.push('/dashboard'); } },
        ].map(item => (
          <button key={item.label} className="hub-btn" onClick={item.action}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer' }}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{ fontSize: 9, color: item.active ? '#d4af37' : '#4a4a5a', letterSpacing: 1, textTransform: 'uppercase', fontWeight: item.active ? 700 : 400 }}>{item.label}</span>
            {item.active && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#d4af37', marginTop: -2 }} />}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function HubPage() {
  return (
    <ErrorBoundary>
      <HubPageInner />
    </ErrorBoundary>
  );
                }
