'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePiAuth } from '@/lib-client/hooks/usePiAuth';

const LIVE_APPS = [
  { name: 'Wallet',       emoji: '💳', href: '/dashboard/wallet',  desc: 'Pi Balance'     },
  { name: 'Orders',       emoji: '📦', href: '/dashboard/orders',  desc: 'Your Orders'    },
  { name: 'KYC',          emoji: '🪪', href: '/dashboard/kyc',     desc: 'Verify ID'      },
  { name: 'AI Assistant', emoji: '🤖', href: '/ai',                desc: 'Smart Assistant'},
];

const SOON_APPS = [
  { name: 'Commerce',   emoji: '🛒', desc: 'Pi Marketplace'   },
  { name: 'Assets',     emoji: '💎', desc: 'Digital Assets'   },
  { name: 'Fundx',      emoji: '📊', desc: 'Investment Fund'  },
  { name: 'Estate',     emoji: '🏠', desc: 'Real Estate'      },
  { name: 'Analytics',  emoji: '📈', desc: 'Data Analytics'   },
  { name: 'Connection', emoji: '🔗', desc: 'Social Network'   },
  { name: 'Insure',     emoji: '🛡️', desc: 'Pi Insurance'     },
  { name: 'Nexus',      emoji: '🌐', desc: 'App Hub'          },
  { name: 'Vip',        emoji: '👑', desc: 'VIP Members'      },
  { name: 'Explorer',   emoji: '✈️', desc: 'Travel & Explore' },
  { name: 'Nbf',        emoji: '🏦', desc: 'Neo Bank'         },
  { name: 'Epic',       emoji: '🔥', desc: 'Gaming Platform'  },
];

export default function HubPage() {
  const { user, isAuthenticated, isLoading } = usePiAuth();
  const router = useRouter();
  const [balance, setBalance] = useState<string>('—');
  const [time, setTime] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const token = localStorage.getItem('tec_access_token');
    fetch(`/api/wallet/balance?userId=${user.id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setBalance(`${Number(d.balance).toFixed(2)} π`))
      .catch(() => {});
  }, [user?.id]);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050508' }}>
        <div style={{ width: 40, height: 40, border: '2px solid #d4af3730', borderTop: '2px solid #d4af37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#050508', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Header ── */}
      <header style={{ padding: '16px 20px', borderBottom: '1px solid #d4af3715', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#050508', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: '#d4af37', letterSpacing: 3 }}>TEC</span>
          <span style={{ fontSize: 10, color: '#4a4a5a', letterSpacing: 2, textTransform: 'uppercase' }}>Hub</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: '#4a4a5a' }}>{time}</span>
          <button
            onClick={() => router.push('/dashboard/notifications')}
            style={{ background: 'none', border: '1px solid #d4af3720', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 16 }}
          >🔔</button>
          <button
            onClick={() => router.push('/dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#d4af3715', border: '1px solid #d4af3730', borderRadius: 10, padding: '6px 12px', cursor: 'pointer' }}
          >
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#d4af37,#b8882a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#0a0800' }}>
              {user?.piUsername?.[0]?.toUpperCase()}
            </div>
            <span style={{ fontSize: 12, color: '#d4af37', fontWeight: 600 }}>@{user?.piUsername}</span>
          </button>
        </div>
      </header>

      {/* ── Wallet Banner ── */}
      <div style={{ margin: '16px', borderRadius: 20, background: 'linear-gradient(135deg, #1a1208 0%, #0d0d14 50%, #0a0f1a 100%)', border: '1px solid #d4af3730', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        onClick={() => router.push('/dashboard/wallet')}
      >
        <div>
          <div style={{ fontSize: 11, color: '#6b6b7a', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Pi Wallet</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#d4af37' }}>{balance}</div>
          <div style={{ fontSize: 11, color: '#4a4a5a', marginTop: 4 }}>Tap to view transactions →</div>
        </div>
        <div style={{ fontSize: 40, opacity: 0.6 }}>💳</div>
      </div>

      {/* ── Live Apps ── */}
      <div style={{ padding: '0 16px', marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', letterSpacing: 1, textTransform: 'uppercase', margin: 0 }}>Live Now</h2>
          <span style={{ fontSize: 11, color: '#7ee7c0', background: '#7ee7c010', border: '1px solid #7ee7c030', padding: '3px 10px', borderRadius: 20 }}>
            {LIVE_APPS.length} Active
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {LIVE_APPS.map(app => (
            <button
              key={app.name}
              onClick={() => router.push(app.href)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#0d0d14', border: '1px solid #d4af3730', borderRadius: 16, cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left' }}
            >
              <span style={{ fontSize: 24, minWidth: 32 }}>{app.emoji}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', marginBottom: 2 }}>{app.name}</div>
                <div style={{ fontSize: 11, color: '#4a4a5a' }}>{app.desc}</div>
              </div>
              <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#7ee7c0', minWidth: 6 }} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Coming Soon ── */}
      <div style={{ padding: '0 16px', marginTop: 24, marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#4a4a5a', letterSpacing: 1, textTransform: 'uppercase', margin: 0 }}>Coming Soon</h2>
          <span style={{ fontSize: 11, color: '#4a4a5a' }}>24 Apps Total</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {SOON_APPS.map(app => (
            <div
              key={app.name}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px 8px', background: '#0d0d14', border: '1px solid #ffffff08', borderRadius: 14, opacity: 0.5 }}
            >
              <span style={{ fontSize: 22 }}>{app.emoji}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#6b6b7a' }}>{app.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom Nav ── */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0d0d14', borderTop: '1px solid #d4af3715', display: 'flex', padding: '10px 0 20px' }}>
        {[
          { icon: '⊞', label: 'Hub',     action: () => {}                                    },
          { icon: '💳', label: 'Wallet',  action: () => router.push('/dashboard/wallet')      },
          { icon: '📦', label: 'Orders',  action: () => router.push('/dashboard/orders')      },
          { icon: '⚙️', label: 'Settings',action: () => router.push('/dashboard')             },
        ].map(item => (
          <button
            key={item.label}
            onClick={item.action}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            <span style={{ fontSize: 9, color: '#4a4a5a', letterSpacing: 1, textTransform: 'uppercase' }}>{item.label}</span>
          </button>
        ))}
      </nav>

    </div>
  );
                      }
