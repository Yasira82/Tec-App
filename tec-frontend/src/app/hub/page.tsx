'use client';

import { LIVE_DOMAINS, COMING_SOON, getVisibleDomains } from '@/domains/_registry';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { usePiAuth } from '@/lib-client/hooks/usePiAuth';
import { getAccessToken } from '@/lib-client/pi/pi-auth';
import { createU2APayment } from '@/lib-client/pi/pi-payment';
import { useRealtimeNotifications } from '@/lib-client/hooks/useRealtimeNotifications';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// ─── Haptic ───────────────────────────────────────────────────
const haptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    const patterns = { light: 10, medium: 25, heavy: 50 };
    navigator.vibrate(patterns[type]);
  }
};

// ─── Toast ────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id:      string;
  type:    ToastType;
  message: string;
  txid?:   string;
}

function ToastContainer({ toasts, onDismiss }: {
  toasts:    Toast[];
  onDismiss: (id: string) => void;
}) {
  const colors: Record<ToastType, { bg: string; border: string; color: string; icon: string }> = {
    success: { bg: '#051a0a', border: '#7ee7c040', color: '#7ee7c0', icon: '✅' },
    error:   { bg: '#1a0505', border: '#e74c3c40', color: '#e74c3c', icon: '❌' },
    info:    { bg: '#0a0f1a', border: '#7eb8f740', color: '#7eb8f7', icon: 'ℹ️' },
    warning: { bg: '#1a1505', border: '#f0c04040', color: '#f0c040', icon: '⚠️' },
  };
  return (
    <div style={{ position: 'fixed', top: 70, left: 16, right: 16, zIndex: 999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
      {toasts.map(toast => {
        const c = colors[toast.type];
        return (
          <div key={toast.id}
            style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10, animation: 'toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1)', pointerEvents: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <span style={{ fontSize: 16 }}>{c.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.color }}>{toast.message}</div>
              {toast.txid && (
                <div style={{ fontSize: 10, color: '#4a4a5a', fontFamily: 'monospace', marginTop: 3 }}>
                  txid: {toast.txid.slice(0, 20)}...
                </div>
              )}
            </div>
            <button onClick={() => onDismiss(toast.id)}
              style={{ background: 'none', border: 'none', color: '#4a4a5a', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}>✕</button>
          </div>
        );
      })}
    </div>
  );
}

// ─── AI Drawer ────────────────────────────────────────────────
function AIDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [input,    setInput]    = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [loading,  setLoading]  = useState(false);

  const send = useCallback(async () => {
    if (!input.trim() || loading) return;
    const send = useCallback(async () => {
  if (!input.trim() || loading) return;
  const text = input.trim();
  setInput('');
  setMessages(prev => [...prev, { role: 'user', text }]);
  setLoading(true);
  try {
    const res = await fetch('/api/ai/chat', {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:        JSON.stringify({
        messages: [{ role: 'user', content: text }],
      }),
    });
    const data = await res.json();
    setMessages(prev => [...prev, { role: 'ai', text: data.reply ?? 'Sorry, no response.' }]);
  } catch {
    setMessages(prev => [...prev, { role: 'ai', text: 'Connection error. Try again.' }]);
  } finally {
    setLoading(false);
  }
}, [input, loading]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, backdropFilter: 'blur(4px)' }} />

      {/* Drawer */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 301, background: '#0a0a12', borderTop: '1px solid #d4af3720', borderRadius: '24px 24px 0 0', padding: '0 0 32px', maxHeight: '75vh', display: 'flex', flexDirection: 'column' }}>

        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#ffffff20' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#d4af37,#b8882a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>TEC AI</div>
              <div style={{ fontSize: 10, color: '#4a4a5a' }}>Powered by tec.pi</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4a4a5a', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#4a4a5a', fontSize: 13 }}>
              مرحباً! أنا مساعدك الذكي على TEC 🤖
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%', padding: '10px 14px', borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: m.role === 'user' ? 'linear-gradient(135deg,#d4af37,#b8882a)' : '#0d0d1a',
                border: m.role === 'ai' ? '1px solid #ffffff08' : 'none',
                fontSize: 13, color: m.role === 'user' ? '#0a0800' : '#fff', lineHeight: 1.5,
              }}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: 4, padding: '8px 0' }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#d4af37', animation: `pulse 1.2s ${i * 0.2}s infinite` }} />
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px 0' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="اسأل TEC AI..."
            style={{ flex: 1, background: '#0d0d14', border: '1px solid #ffffff10', borderRadius: 14, padding: '12px 16px', color: '#fff', fontSize: 13, outline: 'none' }}
          />
          <button onClick={send} disabled={loading || !input.trim()}
            style={{ width: 44, height: 44, borderRadius: 14, background: input.trim() ? 'linear-gradient(135deg,#d4af37,#b8882a)' : '#ffffff08', border: 'none', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, transition: 'all 0.2s' }}>
            ↑
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Pull Indicator ───────────────────────────────────────────
function PullIndicator({ progress, refreshing }: { progress: number; refreshing: boolean }) {
  if (progress === 0 && !refreshing) return null;
  return (
    <div style={{ position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)', zIndex: 200 }}>
      <div style={{ background: '#0d0d14', border: '1px solid #d4af3730', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {refreshing
          ? <div style={{ width: 16, height: 16, border: '2px solid #d4af3730', borderTop: '2px solid #d4af37', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
          : <span style={{ fontSize: 14, transform: `rotate(${progress * 180}deg)`, display: 'inline-block', transition: 'transform 0.1s' }}>↓</span>
        }
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────
function HubSkeleton() {
  return (
    <div style={{ minHeight: '100vh', background: '#020205', padding: '0 0 90px' }}>
      <style>{`
        @keyframes shimmer { 0%,100% { opacity:0.4; } 50% { opacity:0.8; } }
        .sk { animation: shimmer 1.4s ease infinite; background: #0d0d14; border-radius: 18px; }
      `}</style>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #ffffff08', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: '#d4af3730' }} />
          <div style={{ width: 60, height: 20, borderRadius: 6, background: '#ffffff08' }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ffffff08' }} />
          <div style={{ width: 90, height: 36, borderRadius: 12, background: '#ffffff08' }} />
        </div>
      </div>
      <div style={{ padding: '16px 16px 0' }}>
        <div className="sk" style={{ height: 120, border: '1px solid #d4af3715' }} />
      </div>
      <div style={{ padding: '10px 16px 0' }}>
        <div className="sk" style={{ height: 80, border: '1px solid #ffffff08' }} />
      </div>
      <div style={{ padding: '12px 16px 0', display: 'flex', gap: 10 }}>
        <div className="sk" style={{ flex: 1, height: 54, border: '1px solid #7ee7c020' }} />
        <div className="sk" style={{ flex: 1, height: 54, border: '1px solid #7eb8f720' }} />
      </div>
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {[1,2,3,4].map(i => <div key={i} className="sk" style={{ height: 68, border: '1px solid #d4af3710' }} />)}
        </div>
      </div>
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(10,10,18,0.97)', borderTop: '1px solid #ffffff08', display: 'flex', padding: '10px 0 22px' }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: '#ffffff08' }} />
            <div style={{ width: 30, height: 8, borderRadius: 4, background: '#ffffff08' }} />
          </div>
        ))}
      </nav>
    </div>
  );
}

// ─── Hub Inner ────────────────────────────────────────────────
function HubPageInner() {
  const { user, isAuthenticated, isLoading } = usePiAuth();
  const router = useRouter();

  // ✅ Smart Orchestration — user-aware domain visibility
  const userPro = !!user?.subscriptionPlan && user.subscriptionPlan !== 'Free';
  const userKyc = (user as { kycVerified?: boolean } | null)?.kycVerified ?? false;

  const visibleLive = getVisibleDomains(userKyc, userPro)
    .filter(d => d.status === 'live' && d.layer !== 'os')
    .map(d => ({
      name:  d.name.en,
      emoji: d.emoji,
      href:  d.route ?? `/${d.slug}`,
      desc:  d.description.en,
      slug:  d.slug,
    }));

  const [balance,     setBalance]     = useState('—');
  const [assetCount,  setAssetCount]  = useState<number | null>(null);
  const [time,        setTime]        = useState('');
  const [notifCount,  setNotifCount]  = useState(0);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [aiOpen,      setAiOpen]      = useState(false);
  const [piPrice,     setPiPrice]     = useState<{
    price: number; change24h: number; high24h: number; low24h: number;
  } | null>(null);
  const [toasts,       setToasts]       = useState<Toast[]>([]);
  const [pullProgress, setPullProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pullStartY     = useRef(0);
  const isPulling      = useRef(false);
  const touchStartX    = useRef(0);
  const touchEndX      = useRef(0);
  const PULL_THRESHOLD = 80;

  const showToast = useCallback((type: ToastType, message: string, txid?: string) => {
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
    return fetch(`/api/assets?userId=${user.id}`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
    })
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
    return Promise.resolve();
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

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
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
    if (typeof window === 'undefined' || !window.Pi) {
      haptic('heavy'); showToast('error', 'Open in Pi Browser to make payments'); return;
    }
    haptic('medium');
    setBalance(prev => { const n = parseFloat(prev); return isNaN(n) ? prev : (n - 1).toFixed(2); });
    try {
      const result = await createU2APayment(1, 'TEC Super App Payment', { source: 'hub', version: '1.0' });
      if (result.success && result.status === 'completed') {
        haptic('heavy'); showToast('success', 'Payment successful! 🎉', result.txid);
        setTimeout(refreshBalance, 2000);
      } else if (result.status === 'cancelled') {
        haptic('light'); refreshBalance(); showToast('warning', 'Payment cancelled');
      } else {
        haptic('heavy'); refreshBalance(); showToast('error', result.message ?? 'Payment failed');
      }
    } catch (err) {
      haptic('heavy'); refreshBalance();
      const msg = err instanceof Error ? err.message : 'Payment failed';
      if (msg.toLowerCase().includes('pending') || msg.toLowerCase().includes('already have')) {
        showToast('warning', 'Pending payment detected — try again');
      } else { showToast('error', msg); }
    }
  }, [refreshBalance, showToast]);

  if (isLoading || !isAuthenticated) return <HubSkeleton />;

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
      `}</style>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <PullIndicator progress={pullProgress} refreshing={isRefreshing} />

      {/* ── AI Drawer ── */}
      <AIDrawer open={aiOpen} onClose={() => setAiOpen(false)} />

      {/* ── AI Floating Button ── */}
      {!aiOpen && (
        <button
          onClick={() => { haptic('medium'); setAiOpen(true); }}
          style={{
            position: 'fixed', bottom: 90, right: 16, zIndex: 200,
            width: 52, height: 52, borderRadius: '50%',
            background: 'linear-gradient(135deg,#d4af37,#b8882a)',
            border: '2px solid #d4af3740',
            boxShadow: '0 4px 20px rgba(212,175,55,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, cursor: 'pointer',
            animation: 'aiPop 0.4s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
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
              <button className="hub-btn" onClick={() => { haptic('light'); router.push('/dashboard/assets'); }}
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

            {/* Slide 1: Pi Price */}
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
                  ) : (
                    <div style={{ width: 80, height: 40, borderRadius: 8, background: '#ffffff08', animation: 'shimmer 1.4s infinite' }} />
                  )}
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
          {[0, 1].map(i => (
            <button key={i} onClick={() => { haptic('light'); setCarouselIdx(i); }}
              style={{ width: carouselIdx === i ? 16 : 6, height: 6, borderRadius: 3, background: carouselIdx === i ? '#d4af37' : '#ffffff20', border: 'none', cursor: 'pointer', transition: 'all 0.3s ease', padding: 0 }} />
          ))}
        </div>
      </div>

      {/* ── Payment Buttons ── */}
      <div style={{ padding: '12px 16px 0' }} className="fade-in">
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="hub-btn" onClick={handlePay}
            style={{ flex: 1, padding: '16px 12px', borderRadius: 18, background: 'linear-gradient(135deg,#0d2e14,#0a1f0f)', border: '1px solid #7ee7c040', color: '#7ee7c0', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'Georgia,serif', fontSize: 16 }}>π</span>
            <span>Pay 1 π</span>
          </button>
          <button className="hub-btn" onClick={() => { haptic('light'); router.push('/dashboard/wallet'); }}
            style={{ flex: 1, padding: '16px 12px', borderRadius: 18, background: 'linear-gradient(135deg,#0a0f2e,#0a0f1f)', border: '1px solid #7eb8f740', color: '#7eb8f7', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'Georgia,serif', fontSize: 18 }}>π</span>
            <span>Receive π</span>
          </button>
        </div>
      </div>

      {/* ── Live Apps — Smart Orchestration ── */}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}>
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
          { icon: '⊞',  label: 'Hub',      active: true,  action: () => {}                                                    },
          { icon: '💳', label: 'Wallet',   active: false, action: () => { haptic('light'); router.push('/dashboard/wallet'); } },
          { icon: '💎', label: 'Assets',   active: false, action: () => { haptic('light'); router.push('/dashboard/assets'); } },
          { icon: '⚙️', label: 'Settings', active: false, action: () => { haptic('light'); router.push('/dashboard');         } },
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
