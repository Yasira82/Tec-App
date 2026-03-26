'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePiAuth } from '@/lib-client/hooks/usePiAuth';
import { getAccessToken, resolvePendingPayment } from '@/lib-client/pi/pi-auth';
import { createU2APayment } from '@/lib-client/pi/pi-payment';

const LIVE_APPS = [
  { name: 'Wallet',    emoji: '💳', href: '/dashboard/wallet', desc: 'Pi Balance'     },
  { name: 'Orders',    emoji: '📦', href: '/dashboard/orders', desc: 'Your Orders'    },
  { name: 'KYC',       emoji: '🪪', href: '/dashboard/kyc',    desc: 'Verify ID'      },
  { name: 'Assistant', emoji: '🤖', href: '/ai',               desc: 'AI Assistant'   },
];

const SOON_APPS = [
  { name: 'Commerce',   emoji: '🛒' },
  { name: 'Assets',     emoji: '💎' },
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
];

type PayState = 'idle' | 'processing' | 'success' | 'error' | 'cancelled' | 'pending';

export default function HubPage() {
  const { user, isAuthenticated, isLoading } = usePiAuth();
  const router = useRouter();

  const [balance,   setBalance]   = useState('—');
  const [time,      setTime]      = useState('');
  const [payState,  setPayState]  = useState<PayState>('idle');
  const [payMsg,    setPayMsg]    = useState('');
  const [txid,      setTxid]      = useState('');

  // ── Auth guard ─────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/');
  }, [isLoading, isAuthenticated, router]);

  // ── Clock ──────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  // ── Balance ────────────────────────────────────────────────
  const refreshBalance = useCallback(() => {
    if (!user?.id) return;
    const token = localStorage.getItem('tec_access_token');
    fetch(`/api/wallet/balance?userId=${user.id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setBalance(`${Number(d.balance).toFixed(2)}`))
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => { refreshBalance(); }, [refreshBalance]);

  // ── Payment ────────────────────────────────────────────────
  const handlePay = useCallback(async () => {
    if (payState === 'processing') return;
    setPayState('processing');
    setPayMsg('');
    setTxid('');

    try {
      const result = await createU2APayment(1, 'TEC Super App Payment');
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
      const isPending = msg.toLowerCase().includes('pending') || msg.toLowerCase().includes('already have');
      if (isPending) {
        setPayState('pending');
        setPayMsg('Pending payment detected — tap Retry to resolve');
      } else {
        setPayState('error');
        setPayMsg(msg);
      }
    }
  }, [payState, refreshBalance]);

  const handleRetry = useCallback(async () => {
    setPayState('processing');
    setPayMsg('Resolving pending payment...');
    try {
      // Pi SDK سيحل الـ pending تلقائياً عند الـ retry
      await handlePay();
    } catch {
      setPayState('error');
      setPayMsg('Failed to resolve. Try again later.');
    }
  }, [handlePay]);

  // ── Loading ────────────────────────────────────────────────
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
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .hub-btn:active { transform: scale(0.97); }
        .app-btn:active { transform: scale(0.95); }
      `}</style>

      {/* ════════════════════════════════════════
          HEADER
      ════════════════════════════════════════ */}
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
          <button className="hub-btn" onClick={() => router.push('/dashboard/notifications')}
            style={{ width: 36, height: 36, borderRadius: 10, background: '#ffffff08', border: '1px solid #ffffff10', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, transition: 'all 0.2s' }}>
            🔔
          </button>
          <button className="hub-btn" onClick={() => router.push('/dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#d4af3710', border: '1px solid #d4af3725', borderRadius: 12, padding: '6px 10px', cursor: 'pointer', transition: 'all 0.2s' }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#d4af37,#b8882a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#0a0800' }}>
              {user?.piUsername?.[0]?.toUpperCase()}
            </div>
            <span style={{ fontSize: 12, color: '#d4af37', fontWeight: 600 }}>@{user?.piUsername}</span>
          </button>
        </div>
      </header>

      {/* ════════════════════════════════════════
          WALLET CARD
      ════════════════════════════════════════ */}
      <div style={{ padding: '16px 16px 0' }}>
        <button className="hub-btn" onClick={() => router.push('/dashboard/wallet')}
          style={{ width: '100%', borderRadius: 24, background: 'linear-gradient(135deg, #1a1208 0%, #0f0f1a 60%, #0a0f1f 100%)', border: '1px solid #d4af3725', padding: '22px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left' }}>
          <div>
            <div style={{ fontSize: 10, color: '#6b6b7a', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>Pi Wallet Balance</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: '#d4af37', letterSpacing: -1, fontVariantNumeric: 'tabular-nums' }}>{balance}</span>
              <span style={{ fontSize: 20, color: '#d4af3780', fontWeight: 400 }}>π</span>
            </div>
            <div style={{ fontSize: 11, color: '#4a4a5a', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7ee7c0', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              View transactions →
            </div>
          </div>
          <div style={{ fontSize: 44, opacity: 0.15 }}>💳</div>
        </button>
      </div>

      {/* ════════════════════════════════════════
          PAYMENT SECTION
      ════════════════════════════════════════ */}
      <div style={{ padding: '12px 16px 0', animation: 'fadeIn 0.3s ease' }}>

        {/* Pay + A2U buttons */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          {/* Pay Button */}
          <button className="hub-btn"
            onClick={handlePay}
            disabled={payBusy}
            style={{
              flex: 1,
              padding: '16px 12px',
              borderRadius: 18,
              background: payBusy
                ? '#0a1f0f'
                : 'linear-gradient(135deg, #0d2e14, #0a1f0f)',
              border: `1px solid ${payBusy ? '#7ee7c020' : '#7ee7c040'}`,
              color: '#7ee7c0',
              fontWeight: 700,
              fontSize: 13,
              cursor: payBusy ? 'not-allowed' : 'pointer',
              letterSpacing: 0.5,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {payBusy ? (
              <>
                <div style={{ width: 14, height: 14, border: '2px solid #7ee7c030', borderTop: '2px solid #7ee7c0', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>💎</span>
                <span>Pay 1 π</span>
              </>
            )}
          </button>

          {/* A2U Button */}
          <button className="hub-btn"
            onClick={() => router.push('/dashboard')}
            style={{
              flex: 1,
              padding: '16px 12px',
              borderRadius: 18,
              background: 'linear-gradient(135deg, #0a0f2e, #0a0f1f)',
              border: '1px solid #7eb8f740',
              color: '#7eb8f7',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              letterSpacing: 0.5,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 18, lineHeight: 1 }}>π</span>
            <span>Receive A2U</span>
          </button>
        </div>

        {/* Payment Status */}
        {payState !== 'idle' && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 14,
            background: payState === 'success' ? '#051a0a' : payState === 'error' ? '#1a0505' : payState === 'pending' ? '#1a1505' : '#0a0a1a',
            border: `1px solid ${payState === 'success' ? '#7ee7c030' : payState === 'error' ? '#e74c3c30' : payState === 'pending' ? '#f0c04030' : '#ffffff10'}`,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 10,
            animation: 'fadeIn 0.2s ease',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: payState === 'success' ? '#7ee7c0' : payState === 'error' ? '#e74c3c' : payState === 'pending' ? '#f0c040' : '#7eb8f7', marginBottom: txid ? 4 : 0 }}>
                {payState === 'success' && '✅ '}
                {payState === 'error' && '❌ '}
                {payState === 'pending' && '⚠️ '}
                {payState === 'cancelled' && '↩️ '}
                {payState === 'processing' && '⏳ '}
                {payMsg}
              </div>
              {txid && (
                <div style={{ fontSize: 10, color: '#4a4a5a', fontFamily: 'monospace' }}>
                  txid: {txid.slice(0, 20)}...
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {payState === 'pending' && (
                <button className="hub-btn" onClick={handleRetry}
                  style={{ fontSize: 11, color: '#f0c040', background: '#f0c04010', border: '1px solid #f0c04030', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
                  Retry
                </button>
              )}
              <button className="hub-btn" onClick={() => { setPayState('idle'); setPayMsg(''); setTxid(''); }}
                style={{ fontSize: 11, color: '#4a4a5a', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════
          LIVE APPS
      ════════════════════════════════════════ */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7ee7c0', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', letterSpacing: 2, textTransform: 'uppercase' }}>Live Now</span>
          </div>
          <span style={{ fontSize: 10, color: '#7ee7c0', background: '#7ee7c008', border: '1px solid #7ee7c020', padding: '3px 10px', borderRadius: 20, letterSpacing: 1 }}>
            {LIVE_APPS.length} ACTIVE
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {LIVE_APPS.map(app => (
            <button key={app.name} className="app-btn"
              onClick={() => router.push(app.href)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#0d0d14', border: '1px solid #d4af3720', borderRadius: 18, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#d4af3710', border: '1px solid #d4af3720', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, minWidth: 40 }}>
                {app.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.name}</div>
                <div style={{ fontSize: 10, color: '#4a4a5a' }}>{app.desc}</div>
              </div>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7ee7c0', minWidth: 6, animation: 'pulse 2s infinite' }} />
            </button>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════
          COMING SOON
      ════════════════════════════════════════ */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#4a4a5a', letterSpacing: 2, textTransform: 'uppercase' }}>Coming Soon</span>
          <span style={{ fontSize: 10, color: '#4a4a5a', letterSpacing: 1 }}>24 APPS</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {SOON_APPS.map(app => (
            <div key={app.name}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 6px', background: '#0d0d14', border: '1px solid #ffffff06', borderRadius: 14, opacity: 0.45 }}>
              <span style={{ fontSize: 20 }}>{app.emoji}</span>
              <span style={{ fontSize: 9, fontWeight: 600, color: '#6b6b7a', textAlign: 'center', letterSpacing: 0.5 }}>{app.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════
          BOTTOM NAV
      ════════════════════════════════════════ */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(10,10,18,0.97)', backdropFilter: 'blur(20px)', borderTop: '1px solid #ffffff08', display: 'flex', padding: '10px 0 22px' }}>
        {[
          { icon: '⊞',  label: 'Hub',      active: true,  action: () => {}                                },
          { icon: '💳', label: 'Wallet',   active: false, action: () => router.push('/dashboard/wallet') },
          { icon: '📦', label: 'Orders',   active: false, action: () => router.push('/dashboard/orders') },
          { icon: '⚙️', label: 'Settings', active: false, action: () => router.push('/dashboard')        },
        ].map(item => (
          <button key={item.label} className="hub-btn" onClick={item.action}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{ fontSize: 9, color: item.active ? '#d4af37' : '#4a4a5a', letterSpacing: 1, textTransform: 'uppercase', fontWeight: item.active ? 700 : 400 }}>
              {item.label}
            </span>
            {item.active && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#d4af37', marginTop: -2 }} />}
          </button>
        ))}
      </nav>

    </div>
  );
      }
