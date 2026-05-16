'use client';

import { useCallback, useEffect, useState }  from 'react';
import { useRouter }                          from 'next/navigation';
import { usePiAuth }                          from '@/lib-client/hooks/usePiAuth';
import { useTranslation }                     from '@/lib/i18n';
import { getAccessToken }                     from '@/lib-client/pi/pi-auth';
import { DashboardShell, DashboardCard }      from '@/components/dashboard';
import {
  LIVE_DOMAINS, COMING_SOON, getVisibleDomains,
}                                             from '@/domains/_registry';

// ── Types ─────────────────────────────────────────────────
interface Payment {
  id:        string;
  amount:    number;
  status:    string;
  type:      string;
  createdAt: string;
  txHash?:   string;
}

type TabKey = 'overview' | 'domains' | 'activity';

// ── Domain Groups ──────────────────────────────────────────
const FINANCE      = LIVE_DOMAINS.filter(d => d.group === 'finance');
const COMMERCE_GRP = LIVE_DOMAINS.filter(d => d.group === 'commerce');
const REAL_WORLD   = LIVE_DOMAINS.filter(d => d.group === 'real_world');
const SOCIAL       = LIVE_DOMAINS.filter(d => d.group === 'social');
const TECH         = LIVE_DOMAINS.filter(d => d.group === 'tech');
const MONETIZATION = LIVE_DOMAINS.filter(d => d.group === 'monetization');

const LIVE_APPS = LIVE_DOMAINS.filter(d => d.status === 'live');

// ── Domain Card ────────────────────────────────────────────
function DomainCard({ emoji, name, domain, status, onClick }: {
  emoji:    string;
  name:     string;
  domain:   string;
  status:   string;
  onClick?: () => void;
}) {
  const isLive = status === 'live';
  return (
    <div onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: 'var(--sp-3) var(--sp-4)',
        background: 'var(--tec-surface-2)',
        border: `1px solid ${isLive ? 'rgba(16,185,129,0.15)' : 'var(--tec-border)'}`,
        borderRadius: 'var(--radius-md)', cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.2s ease',
      }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: isLive ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isLive ? 'rgba(16,185,129,0.2)' : 'var(--tec-border)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
      }}>{emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--tec-text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>{domain}</div>
      </div>
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: 1, padding: '2px 8px',
        borderRadius: 'var(--radius-full)',
        background: isLive ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
        color: isLive ? '#10b981' : 'var(--tec-text-3)',
        border: `1px solid ${isLive ? 'rgba(16,185,129,0.2)' : 'var(--tec-border)'}`,
      }}>
        {isLive ? 'LIVE' : 'SOON'}
      </span>
    </div>
  );
}

function DomainGroup({ title, emoji, domains }: {
  title:   string;
  emoji:   string;
  domains: typeof LIVE_DOMAINS;
}) {
  if (!domains.length) return null;
  return (
    <div style={{ marginBottom: 'var(--sp-6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--sp-3)' }}>
        <span style={{ fontSize: 16 }}>{emoji}</span>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--tec-text-3)', letterSpacing: 2, textTransform: 'uppercase' }}>{title}</span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', marginLeft: 'auto' }}>{domains.length}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8 }}>
        {domains.map(d => (
          <DomainCard key={d.slug} emoji={d.emoji} name={d.name.en} domain={d.piDomain}
            status={d.status} onClick={d.route ? () => { window.location.href = d.route!; } : undefined} />
        ))}
      </div>
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────
function StatCard({ label, value, sub, icon, accent }: {
  label:   string;
  value:   string;
  sub:     string;
  icon:    string;
  accent?: string;
}) {
  return (
    <div style={{
      padding: 'var(--sp-4) var(--sp-5)',
      background: 'var(--tec-surface-2)',
      border: '1px solid var(--tec-border)',
      borderRadius: 'var(--radius-xl)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 16, right: 16, fontSize: 22, opacity: 0.4 }}>{icon}</div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 900, color: accent ?? 'var(--tec-gold)', lineHeight: 1, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>{sub}</div>
    </div>
  );
}

// ── Transaction Row ────────────────────────────────────────
function TxRow({ payment }: { payment: Payment }) {
  const positive = ['credit', 'receive', 'refund'].includes(payment.type?.toLowerCase());
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: 'var(--sp-3) var(--sp-4)',
      borderBottom: '1px solid var(--tec-border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: payment.status === 'completed' ? '#10b981' : payment.status === 'failed' ? '#ef4444' : '#f59e0b',
        }} />
        <div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-1)', fontWeight: 500 }}>{payment.type}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>
            {new Date(payment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: positive ? '#10b981' : 'var(--tec-text-1)' }}>
          {positive ? '+' : ''}{Number(payment.amount).toFixed(2)} π
        </div>
        <div style={{ fontSize: 9, color: 'var(--tec-text-3)', letterSpacing: 1, textTransform: 'uppercase' }}>
          {payment.status}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function DashboardPage() {
  const { user, isAuthenticated, isLoading } = usePiAuth();
  const { t }  = useTranslation();
  const router = useRouter();

  const [balance,        setBalance]        = useState<number | null>(null);
  const [payments,       setPayments]       = useState<Payment[]>([]);
  const [kycVerified,    setKycVerified]    = useState<boolean | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [dataLoading,    setDataLoading]    = useState(true);
  const [activeTab,      setActiveTab]      = useState<TabKey>('overview');

  const userPro   = !!user?.subscriptionPlan && user.subscriptionPlan !== 'Free';
  const userKyc   = kycVerified ?? false;
  const isNewUser = user && !payments.length;

  const visibleLive = getVisibleDomains(userKyc, userPro)
    .filter(d => d.status === 'live' && d.layer !== 'os');

  const fetchData = useCallback(async () => {
    if (!user?.id || !isAuthenticated) return;
    setDataLoading(true);
    const token = getAccessToken();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    // Balance
    try {
      const res = await fetch(`/api/wallet/balance?userId=${user.id}`, { credentials: 'include', headers, cache: 'no-store' });
      if (res.ok) { const d = await res.json(); setBalance(Number(d.data?.balance ?? d.balance ?? 0)); }
    } catch {}

    // History
    try {
      setHistoryLoading(true);
      const res = await fetch('/api/bff/payments/history?limit=5&sort=desc', { credentials: 'include', cache: 'no-store' });
      if (res.ok) { const d = await res.json(); setPayments(d?.data?.payments ?? []); }
    } catch {} finally { setHistoryLoading(false); }

    // KYC
    try {
      const res = await fetch('/api/bff/kyc/status', { credentials: 'include', cache: 'no-store' });
      if (res.ok) { const d = await res.json(); setKycVerified(d.verified ?? d.kycVerified ?? false); }
    } catch {}

    setDataLoading(false);
  }, [user?.id, isAuthenticated]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const completedPayments = payments.filter(p => p.status === 'completed');
  const totalPiSpent      = completedPayments.reduce((s, p) => s + Number(p.amount), 0);

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'overview',  label: 'Overview',     icon: '⊞' },
    { key: 'domains',   label: 'Ecosystem',    icon: '🌐' },
    { key: 'activity',  label: 'Activity',     icon: '📋' },
  ];

  return (
    <DashboardShell loading={isLoading || dataLoading}>

      {/* ── Welcome Banner ────────────────────────────── */}
      {isNewUser && (
        <div className="tec-fade-in" style={{
          padding: 'var(--sp-4) var(--sp-5)',
          background: 'linear-gradient(135deg, rgba(212,175,55,0.1), rgba(212,175,55,0.05))',
          border: '1px solid var(--tec-border-gold)',
          borderRadius: 'var(--radius-lg)', marginBottom: 'var(--sp-6)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 24 }}>🎉</span>
          <div>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--tec-gold)' }}>Welcome to TEC Ecosystem</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)' }}>Your account is ready — explore 24 sovereign apps on Pi Network</div>
          </div>
        </div>
      )}

      {/* ── User Header ───────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-6)', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        <div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', marginBottom: 4 }}>{t.dashboard.greeting}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg,#d4af37,#b8882a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 900, color: '#0a0800',
            }}>
              {user?.piUsername?.[0]?.toUpperCase()}
            </div>
            <div>
              <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--tec-text-1)', margin: 0 }}>
                @{user?.piUsername}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 10, color: 'var(--tec-text-3)', letterSpacing: 1 }}>{user?.role?.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {kycVerified !== null && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              background: kycVerified ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${kycVerified ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
              color: kycVerified ? '#10b981' : '#ef4444',
            }}>
              {kycVerified ? '✓ KYC Verified' : '! KYC Pending'}
            </span>
          )}
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--tec-gold-glow)',
            border: '1px solid var(--tec-border-gold)',
            color: 'var(--tec-gold)',
          }}>
            ◈ {user?.subscriptionPlan ?? 'Free'}
          </span>
          <button onClick={fetchData} className="tec-btn"
            style={{
              padding: '6px 14px', borderRadius: 'var(--radius-sm)',
              background: 'var(--tec-surface-2)', border: '1px solid var(--tec-border)',
              color: 'var(--tec-text-2)', fontSize: 'var(--text-sm)', cursor: 'pointer',
            }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── Stats Grid ────────────────────────────────── */}
      <div className="tec-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 'var(--sp-3)', marginBottom: 'var(--sp-6)' }}>
        <StatCard
          icon="π"
          label="Pi Balance"
          value={balance !== null ? `${balance.toFixed(2)}π` : '—π'}
          sub="Wallet balance"
          accent="var(--tec-gold)"
        />
        <StatCard
          icon="📤"
          label="Pi Spent"
          value={`${totalPiSpent.toFixed(2)}π`}
          sub={`${completedPayments.length} transactions`}
          accent="var(--tec-text-1)"
        />
        <StatCard
          icon="🚀"
          label="Live Apps"
          value={`${LIVE_APPS.length}`}
          sub={`of ${LIVE_DOMAINS.length + COMING_SOON.length} total`}
          accent="#10b981"
        />
        <StatCard
          icon="◈"
          label="Plan"
          value={user?.subscriptionPlan ?? 'Free'}
          sub={userPro ? 'Active subscription' : 'Upgrade available'}
          accent={userPro ? '#8b5cf6' : 'var(--tec-text-2)'}
        />
      </div>

      {/* ── Tabs ──────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)', borderBottom: '1px solid var(--tec-border)', paddingBottom: 'var(--sp-3)' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="tec-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 'var(--radius-sm)',
              border: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)',
              fontWeight: activeTab === tab.key ? 700 : 400,
              color:      activeTab === tab.key ? 'var(--tec-gold)' : 'var(--tec-text-3)',
              background: activeTab === tab.key ? 'var(--tec-gold-dim)' : 'transparent',
            }}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Overview Tab ──────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="tec-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>

          {/* Quick Actions */}
          <DashboardCard title="Quick Actions">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 'var(--sp-3)' }}>
              {[
                { label: 'Wallet',        icon: '💳', href: '/dashboard/wallet',        color: '#3b82f6' },
                { label: 'KYC',           icon: '🪪', href: '/dashboard/kyc',           color: '#10b981' },
                { label: 'Subscription',  icon: '◈',  href: '/dashboard/subscription',  color: '#8b5cf6' },
                { label: 'Notifications', icon: '🔔', href: '/dashboard/notifications', color: '#f59e0b' },
              ].map(a => (
                <button key={a.label} onClick={() => router.push(a.href)} className="tec-btn"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: 'var(--sp-3) var(--sp-4)',
                    background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border)',
                    borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}>
                  <span style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: `${a.color}15`, border: `1px solid ${a.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                  }}>{a.icon}</span>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--tec-text-1)' }}>{a.label}</span>
                </button>
              ))}
            </div>
          </DashboardCard>

          {/* Live Apps */}
          <DashboardCard
            title="Live Apps"
            subtitle={`${visibleLive.length} active`}
            action={
              <button onClick={() => setActiveTab('domains')} className="tec-btn"
                style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                View all →
              </button>
            }
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 'var(--sp-2)' }}>
              {visibleLive.slice(0, 6).map(d => (
                <DomainCard key={d.slug} emoji={d.emoji} name={d.name.en} domain={d.piDomain}
                  status={d.status} onClick={d.route ? () => router.push(d.route!) : undefined} />
              ))}
            </div>
          </DashboardCard>

          {/* Coming Soon Preview */}
          <DashboardCard title="Coming Soon" subtitle={`${COMING_SOON.length} domains`}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(80px,1fr))', gap: 'var(--sp-2)' }}>
              {COMING_SOON.slice(0, 12).map(d => (
                <div key={d.slug} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: 'var(--sp-3) var(--sp-2)',
                  background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border)',
                  borderRadius: 'var(--radius-md)', opacity: 0.5,
                }}>
                  <span style={{ fontSize: 20 }}>{d.emoji}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--tec-text-3)', textAlign: 'center' }}>{d.name.en}</span>
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>
      )}

      {/* ── Domains Tab ───────────────────────────────── */}
      {activeTab === 'domains' && (
        <div className="tec-fade-in">
          <DashboardCard title="TEC Ecosystem" subtitle={`${LIVE_DOMAINS.length + COMING_SOON.length} total domains`}>
            <DomainGroup title="Finance"    emoji="💰" domains={FINANCE}      />
            <DomainGroup title="Commerce"   emoji="🛒" domains={COMMERCE_GRP} />
            <DomainGroup title="Real World" emoji="🏙️" domains={REAL_WORLD}   />
            <DomainGroup title="Social"     emoji="🌍" domains={SOCIAL}       />
            <DomainGroup title="Tech"       emoji="⚡" domains={TECH}         />
            <DomainGroup title="Membership" emoji="🏆" domains={MONETIZATION} />
          </DashboardCard>
        </div>
      )}

      {/* ── Activity Tab ──────────────────────────────── */}
      {activeTab === 'activity' && (
        <div className="tec-fade-in">
          <DashboardCard
            title="Recent Transactions"
            subtitle={`${payments.length} records`}
            action={
              <button onClick={() => router.push('/dashboard/wallet')} className="tec-btn"
                style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                View all →
              </button>
            }
            padding="0"
          >
            {historyLoading ? (
              <div style={{ padding: 'var(--sp-8)', display: 'flex', justifyContent: 'center' }}>
                <div className="tec-spin" style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(212,175,55,0.15)', borderTopColor: 'var(--tec-gold)' }} />
              </div>
            ) : payments.length === 0 ? (
              <div style={{ padding: 'var(--sp-8)', textAlign: 'center', color: 'var(--tec-text-3)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                <div style={{ fontSize: 'var(--text-sm)' }}>No transactions yet</div>
              </div>
            ) : (
              payments.map(p => <TxRow key={p.id} payment={p} />)
            )}
          </DashboardCard>
        </div>
      )}

    </DashboardShell>
  );
      }
