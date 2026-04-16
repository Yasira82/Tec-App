'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { usePiAuth } from '@/lib-client/hooks/usePiAuth';
import { getAccessToken } from '@/lib-client/pi/pi-auth';
import { createU2APayment } from '@/lib-client/pi/pi-payment';
import { useRealtimeNotifications } from '@/lib-client/hooks/useRealtimeNotifications';

const LIVE_APPS = [
  { name: 'Wallet',    emoji: '💳', href: '/dashboard/wallet',  desc: 'Pi Balance'     },
  { name: 'Orders',    emoji: '📦', href: '/dashboard/orders',  desc: 'Your Orders'    },
  { name: 'Assets',    emoji: '💎', href: '/dashboard/assets',  desc: 'Digital Assets' },
  { name: 'KYC',       emoji: '🪪', href: '/dashboard/kyc',     desc: 'Verify ID'      },
  { name: 'Assistant', emoji: '🤖', href: '/ai',                desc: 'AI Assistant'   },
];

const SOON_APPS = [
  { name: 'Commerce',   emoji: '🛒' },
  { name: 'Fundx',      emoji: '📊' },
  { name: 'Estate',     emoji: '🏠' },
  { name: 'Analytics',  emoji: '📈' },
  { name: 'Connection', emoji: '🔗' },
  { name: 'Insure',     emoji: '🛡️' },
  { name: 'Nexus',      emoji: '🌐' },
  { name: 'Vip',        emoji: '👑' },
  { name: 'Explorer',   emoji: '✈️' },
  { name: 'Nbf',        emoji: '🏦' },
  { name: 'Epic',       emoji: '🔥' },
  { name: 'Legend',     emoji: '⭐' },
];

type PayState = 'idle' | 'processing' | 'success' | 'error' | 'cancelled' | 'pending';

export default function HubPage() {
  const { user, isAuthenticated, isLoading } = usePiAuth();
  const router = useRouter();

  const [balance,    setBalance]    = useState('—');
  const [assetCount, setAssetCount] = useState<number | null>(null);
  const [time,       setTime]       = useState('');
  const [payState,   setPayState]   = useState<PayState>('idle');
  const [payMsg,     setPayMsg]     = useState('');
  const [txid,       setTxid]       = useState('');
  const [notifCount, setNotifCount] = useState(0);
  const [piPrice,    setPiPrice]    = useState<{
    price: number; change24h: number; high24h: number; low24h: number;
  } | null>(null);
  const [carouselIdx, setCarouselIdx] = useState(0);

  // ── Swipe ──────────────────────────────────────────────────
  const touchStartX = useRef<number>(0);
  const touchEndX   = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 40) {
      if (diff > 0) setCarouselIdx(1); // swipe left → Pi Price
      else          setCarouselIdx(0); // swipe right → Assets
    }
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  const refreshBalance = useCallback(() => {
    if (!user?.id) return;
    fetch(`/api/wallet/balance?userId=${user.id}`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setBalance(`${Number(d.balance).toFixed(2)}`))
      .catch(() => {});
  }, [user?.id]);

  const refreshAssets = useCallback(() => {
    if (!user?.id) return;
    fetch(`/api/assets?userId=${user.id}`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setAssetCount(d.count ?? d.data?.length ?? 0))
      .catch(() => {});
  }, [user?.id]);

  const refreshNotifCount = useCallback(() => {
    if (!user?.id) return;
    const token = getAccessToken();
    fetch(`/api/notifications/unread-count?userId=${user.id}`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token ?? ''}` },
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
    refreshBalance();
    refreshAssets();
  }, [refreshBalance, refreshAssets]);

  useEffect(() => {
    refreshNotifCount();
    const interval = setInterval(refreshNotifCount, 10000);
    return () => clearInterval(interval);
  }, [refreshNotifCount]);

  useEffect(() => {
    refreshPrice();
    const interval = setInterval(refreshPrice, 60000);
    return () => clearInterval(interval);
  }, [refreshPrice]);

  // ── Auto-advance carousel ──────────────────────────────────
  useEffect(() => {
    if (!piPrice) return;
    const id = setInterval(() => {
      setCarouselIdx(prev => prev === 0 ? 1 : 0);
    }, 5000);
    return () => clearInterval(id);
  }, [piPrice]);

  const { unread: wsUnread, clearUnread } = useRealtimeNotifications({
    userId: user?.id,
    token:  getAccessToken(),
    onWalletUpdate: () => setTimeout(refreshBalance, 500),
  });

  const handlePay = useCallback(async () => {
    if (payState === 'processing') return;
    if (typeof window === 'undefined' || !window.Pi) {
      setPayState('error');
      setPayMsg('Open in Pi Browser to make payments');
      return;
    }
    setPayState('processing');
    setPayMsg('');
    setTxid('');
    try {
      const result = await createU2APayment(1, 'TEC Super App Payment', { source: 'hub', version: '1.0' });
      if (result.success && result.status === 'completed') {
        setPayState('success');
        setTxid(result.txid ?? '');
        setPayMsg('Payment successful! 🎉');
        setTimeout(refreshBalance, 2000);
      } else if (result.status === 'cancelled') {
        setPayState('cancelled');
        setPayMsg('Payment cancelled');
      } else {
        setPayState('error');
        setPayMsg(result.message ?? 'Payment failed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payment failed';
      if (msg.toLowerCase().includes('pending') || msg.toLowerCase().includes('already have')) {
        setPayState('pending');
        setPayMsg('Pending payment detected — tap Retry');
      } else {
        setPayState('error');
        setPayMsg(msg);
      }
    }
  }, [payState, refreshBalance]);

  if (isLoading || !isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020205' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '2px solid #d4af3720', borderTop: '2px solid #d4af37', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <div style={{ fontSize: 12, color: '#4a4a5a', letterSpacing: 2 }}>LOADING TEC HUB</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const payBusy = payState === 'processing';

  return (
    <div style={{ minHeight: '100vh', background: '#020205', color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif', paddingBottom: 90 }}>
      <style>{`
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes pulse  { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        .hub-btn:active { transform: scale(0.97); }
        .app-btn:active { transform: scale(0.95); }
      `}</style>

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
            onClick={() => { clearUnread(); setNotifCount(0); router.push('/dashboard/notifications'); }}
            style={{ width: 36, height: 36, borderRadius: 10, background: '#ffffff08', border: '1px solid #ffffff10', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, position: 'relative' }}>
            🔔
            {(wsUnread > 0 || notifCount > 0) && (
              <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#e74c3c', border: '2px solid #020205', fontSize: 9, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                {wsUnread > 0 ? wsUnread : notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>
          <button className="hub-btn" onClick={() => router.push('/dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#d4af3710', border: '1px solid #d4af3725', borderRadius: 12, padding: '6px 10px', cursor: 'pointer' }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#d4af37,#b8882a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#0a0800' }}>
              {user?.piUsername?.[0]?.toUpperCase()}
            </div>
            <span style={{ fontSize: 12, color: '#d4af37', fontWeight: 600 }}>@{user?.piUsername}</span>
          </button>
        </div>
      </header>

      {/* ── Wallet Card ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <button className="hub-btn" onClick={() => router.push('/dashboard/wallet')}
          style={{ width: '100%', borderRadius: 24, background: 'linear-gradient(135deg,#1a1208 0%,#0f0f1a 60%,#0a0f1f 100%)', border: '1px solid #d4af3725', padding: '22px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}>
          <div>
            <div style={{ fontSize: 10, color: '#6b6b7a', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>PI WALLET BALANCE</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: '#d4af37', letterSpacing: -1 }}>{balance}</span>
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

      {/* ── Carousel: Assets + Pi Price ── */}
      <div style={{ padding: '10px 16px 0' }}>
        {/* Slides */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ overflow: 'hidden', borderRadius: 18 }}
        >
          <div style={{
            display: 'flex',
            transition: 'transform 0.35s ease',
            transform: `translateX(-${carouselIdx * 100}%)`,
          }}>
            {/* ── Slide 0: Digital Assets ── */}
            <div style={{ minWidth: '100%' }}>
              <button className="hub-btn" onClick={() => router.push('/dashboard/assets')}
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
                    {assetCount === null ? '—' : assetCount}
                  </div>
                  <div style={{ fontSize: 9, color: '#4a4a5a', letterSpacing: 1, marginTop: 3 }}>ASSETS →</div>
                </div>
              </button>
            </div>

            {/* ── Slide 1: Pi Price ── */}
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
                  {piPrice && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#d4af37' }}>
                        ${piPrice.price.toFixed(4)}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: piPrice.change24h >= 0 ? '#7ee7c0' : '#e74c3c' }}>
                        {piPrice.change24h >= 0 ? '▲' : '▼'} {Math.abs(piPrice.change24h).toFixed(2)}%
                      </div>
                    </div>
                  )}
                </div>
                {piPrice && (
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
                )}
                {!piPrice && (
                  <div style={{ fontSize: 12, color: '#4a4a5a', textAlign: 'center', padding: '8px 0' }}>
                    Loading price...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Dots ── */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8 }}>
          {[0, 1].map(i => (
            <button key={i} onClick={() => setCarouselIdx(i)}
              style={{ width: carouselIdx === i ? 16 : 6, height: 6, borderRadius: 3, background: carouselIdx === i ? '#d4af37' : '#ffffff20', border: 'none', cursor: 'pointer', transition: 'all 0.3s ease', padding: 0 }}
            />
          ))}
        </div>
      </div>

      {/* ── Payment Buttons ── */}
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <button className="hub-btn" onClick={handlePay} disabled={payBusy}
            style={{ flex: 1, padding: '16px 12px', borderRadius: 18, background: 'linear-gradient(135deg,#0d2e14,#0a1f0f)', border: `1px solid ${payBusy ? '#7ee7c020' : '#7ee7c040'}`, color: '#7ee7c0', fontWeight: 700, fontSize: 13, cursor: payBusy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {payBusy ? (
              <>
                <div style={{ width: 14, height: 14, border: '2px solid #7ee7c030', borderTop: '2px solid #7ee7c0', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                <span>Processing...</span>
              </>
            ) : (
              <><span style={{ fontFamily: 'Georgia,serif', fontSize: 16 }}>π</span><span>Pay 1 π</span></>
            )}
          </button>
          <button className="hub-btn" onClick={() => router.push('/dashboard/wallet')}
            style={{ flex: 1, padding: '16px 12px', borderRadius: 18, background: 'linear-gradient(135deg,#0a0f2e,#0a0f1f)', border: '1px solid #7eb8f740', color: '#7eb8f7', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'Georgia,serif', fontSize: 18 }}>π</span>
            <span>Receive π</span>
          </button>
        </div>

        {payState !== 'idle' && (
          <div style={{ padding: '12px 16px', borderRadius: 14, background: payState === 'success' ? '#051a0a' : payState === 'error' ? '#1a0505' : payState === 'pending' ? '#1a1505' : '#0a0a1a', border: `1px solid ${payState === 'success' ? '#7ee7c030' : payState === 'error' ? '#e74c3c30' : payState === 'pending' ? '#f0c04030' : '#ffffff10'}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, animation: 'fadeIn 0.2s ease' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: payState === 'success' ? '#7ee7c0' : payState === 'error' ? '#e74c3c' : payState === 'pending' ? '#f0c040' : '#7eb8f7', marginBottom: txid ? 4 : 0 }}>
                {payState === 'success'    && '✅ '}
                {payState === 'error'      && '❌ '}
                {payState === 'pending'    && '⚠️ '}
                {payState === 'cancelled'  && '↩️ '}
                {payState === 'processing' && '⏳ '}
                {payMsg}
              </div>
              {txid && <div style={{ fontSize: 10, color: '#4a4a5a', fontFamily: 'monospace' }}>txid: {txid.slice(0, 20)}...</div>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {payState === 'pending' && (
                <button className="hub-btn" onClick={handlePay}
                  style={{ fontSize: 11, color: '#f0c040', background: '#f0c04010', border: '1px solid #f0c04030', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
                  Retry
                </button>
              )}
              <button className="hub-btn" onClick={() => { setPayState('idle'); setPayMsg(''); setTxid(''); }}
                style={{ fontSize: 11, color: '#4a4a5a', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Live Apps ── */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7ee7c0', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: 2, textTransform: 'uppercase' }}>Live Now</span>
          </div>
          <span style={{ fontSize: 10, color: '#7ee7c0', background: '#7ee7c008', border: '1px solid #7ee7c020', padding: '3px 10px', borderRadius: 20, letterSpacing: 1 }}>
            {LIVE_APPS.length} ACTIVE
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {LIVE_APPS.map(app => (
            <button key={app.name} className="app-btn" onClick={() => router.push(app.href)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#0d0d14', border: '1px solid #d4af3720', borderRadius: 18, cursor: 'pointer', textAlign: 'left' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#4a4a5a', letterSpacing: 2, textTransform: 'uppercase' }}>Coming Soon</span>
          <span style={{ fontSize: 10, color: '#4a4a5a', letterSpacing: 1 }}>24 APPS</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {SOON_APPS.map(app => (
            <div key={app.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 6px', background: '#0d0d14', border: '1px solid #ffffff06', borderRadius: 14, opacity: 0.45 }}>
              <span style={{ fontSize: 20 }}>{app.emoji}</span>
              <span style={{ fontSize: 9, fontWeight: 600, color: '#6b6b7a', textAlign: 'center' }}>{app.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom Nav ── */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(10,10,18,0.97)', backdropFilter: 'blur(20px)', borderTop: '1px solid #ffffff08', display: 'flex', padding: '10px 0 22px' }}>
        {[
          { icon: '⊞',  label: 'Hub',      active: true,  action: () => {}                                },
          { icon: '💳', label: 'Wallet',   active: false, action: () => router.push('/dashboard/wallet') },
          { icon: '💎', label: 'Assets',   active: false, action: () => router.push('/dashboard/assets') },
          { icon: '⚙️', label: 'Settings', active: false, action: () => router.push('/dashboard')        },
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
