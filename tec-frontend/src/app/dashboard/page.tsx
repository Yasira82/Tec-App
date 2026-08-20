'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useRouter }                                   from 'next/navigation';
import { usePiAuth }                                   from '@/lib-client/hooks/usePiAuth';
import { useTranslation }                              from '@/lib/i18n';
import { getAccessToken }                              from '@/lib-client/pi/pi-auth';
import { DashboardShell, DashboardCard }               from '@/components/dashboard';
import { LIVE_DOMAINS, COMING_SOON, getVisibleDomains } from '@/domains/_registry';

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
const LIVE_APPS    = LIVE_DOMAINS.filter(d => d.status === 'live');

// Open a domain the SAME way the Hub does: external (http) apps go through Hub SSO
// so they land WITH a session; internal routes navigate directly. Fixes apps that
// "don't open" — direct nav dropped the session, and router.push can't leave the app.
function openDomainRoute(route: string) {
  const href = route.startsWith('http')
    ? `/api/auth/sso?target=${encodeURIComponent(route)}`
    : route;
  window.location.href = href;
}

// ── Domain Card ────────────────────────────────────────────
function DomainCard({ emoji, name, domain, status, onClick }: {
  emoji: string; name: string; domain: string; status: string; onClick?: () => void;
}) {
  const isLive = status === 'live';
  return (
    <div onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'var(--sp-3) var(--sp-4)', background: 'var(--tec-surface-2)', border: `1px solid ${isLive ? 'rgba(34,197,94,0.15)' : 'var(--tec-border)'}`, borderRadius: 'var(--radius-md)', cursor: onClick ? 'pointer' : 'default', transition: 'border-color 0.2s ease' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: isLive ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isLive ? 'rgba(34,197,94,0.2)' : 'var(--tec-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--tec-text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>{domain}</div>
      </div>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: isLive ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)', color: isLive ? '#22C55E' : 'var(--tec-text-3)', border: `1px solid ${isLive ? 'rgba(34,197,94,0.2)' : 'var(--tec-border)'}` }}>
        {isLive ? 'LIVE' : 'SOON'}
      </span>
    </div>
  );
}

function DomainGroup({ title, emoji, domains }: { title: string; emoji: string; domains: typeof LIVE_DOMAINS }) {
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
            status={d.status} onClick={d.route ? () => openDomainRoute(d.route!) : undefined} />
        ))}
      </div>
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────
function StatCard({ label, value, sub, icon, accent }: {
  label: string; value: string; sub: string; icon: string; accent?: string;
}) {
  return (
    <div style={{ padding: 'var(--sp-4) var(--sp-5)', background: 'var(--tec-surface-2)', border: '1px solid var(--tec-border)', borderRadius: 'var(--radius-xl)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 16, right: 16, fontSize: 22, opacity: 0.4 }}>{icon}</div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 900, color: accent ?? 'var(--tec-gold)', lineHeight: 1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>{sub}</div>
    </div>
  );
}

// ── Balance Chart (SVG) ────────────────────────────────────
function BalanceChart({ payments }: { payments: Payment[] }) {
  const W = 340; const H = 100; const PAD = { t: 10, r: 10, b: 24, l: 36 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  // بنبني daily spending من الـ payments
  const chartData = useMemo(() => {
    const days: { label: string; amount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toDateString();
      const label = d.toLocaleDateString('en-US', { weekday: 'short' });
      const amount = payments
        .filter(p => new Date(p.createdAt).toDateString() === key && p.status === 'completed')
        .reduce((s, p) => s + Number(p.amount), 0);
      days.push({ label, amount });
    }
    return days;
  }, [payments]);

  const maxVal = Math.max(...chartData.map(d => d.amount), 1);

  const points = chartData.map((d, i) => {
    const x = PAD.l + (i / (chartData.length - 1)) * innerW;
    const y = PAD.t + innerH - (d.amount / maxVal) * innerH;
    return { x, y, ...d };
  });

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
  const area = [
    `${PAD.l},${PAD.t + innerH}`,
    ...points.map(p => `${p.x},${p.y}`),
    `${PAD.l + innerW},${PAD.t + innerH}`,
  ].join(' ');

  const hasData = chartData.some(d => d.amount > 0);

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      {!hasData ? (
        <div style={{ height: H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <span style={{ fontSize: 24, opacity: 0.3 }}>📊</span>
          <span style={{ fontSize: 11, color: 'var(--tec-text-3)' }}>No spending data yet</span>
        </div>
      ) : (
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(r => (
            <line key={r}
              x1={PAD.l} y1={PAD.t + innerH * (1 - r)}
              x2={PAD.l + innerW} y2={PAD.t + innerH * (1 - r)}
              stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          ))}

          {/* Y axis labels */}
          {[0, 0.5, 1].map(r => (
            <text key={r}
              x={PAD.l - 4} y={PAD.t + innerH * (1 - r) + 4}
              textAnchor="end" fontSize={8} fill="rgba(255,255,255,0.3)">
              {(maxVal * r).toFixed(0)}π
            </text>
          ))}

          {/* Area fill */}
          <polygon points={area} fill="url(#gold-grad)" opacity={0.15} />

          {/* Line */}
          <polyline points={polyline} fill="none" stroke="#FBBF24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

          {/* Gradient */}
          <defs>
            <linearGradient id="gold-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FBBF24" stopOpacity={1} />
              <stop offset="100%" stopColor="#FBBF24" stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Dots + X labels */}
          {points.map((p, i) => (
            <g key={i}>
              {p.amount > 0 && (
                <>
                  <circle cx={p.x} cy={p.y} r={4} fill="#FBBF24" />
                  <circle cx={p.x} cy={p.y} r={7} fill="#FBBF24" opacity={0.2} />
                </>
              )}
              <text x={p.x} y={H - 4} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.4)">
                {p.label}
              </text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

// ── Transaction Type Config ────────────────────────────────
const TX_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  payment:   { icon: '💳', color: '#FBBF24', label: 'Payment'   },
  receive:   { icon: '📥', color: '#22C55E', label: 'Received'  },
  credit:    { icon: '📥', color: '#22C55E', label: 'Credit'    },
  debit:     { icon: '📤', color: '#ef4444', label: 'Debit'     },
  transfer:  { icon: '↔️', color: '#3b82f6', label: 'Transfer'  },
  refund:    { icon: '↩️', color: '#8b5cf6', label: 'Refund'    },
  withdraw:  { icon: '📤', color: '#f59e0b', label: 'Withdraw'  },
  deposit:   { icon: '📥', color: '#22C55E', label: 'Deposit'   },
};

// ── Transaction Row (Enhanced) ─────────────────────────────
function TxRow({ payment }: { payment: Payment }) {
  const [expanded, setExpanded] = useState(false);
  const type    = payment.type?.toLowerCase() ?? '';
  const cfg     = TX_CONFIG[type] ?? { icon: '🔄', color: 'var(--tec-text-3)', label: payment.type };
  const positive = ['credit', 'receive', 'refund', 'deposit'].includes(type);

  const statusColor = payment.status === 'completed' ? '#22C55E'
    : payment.status === 'failed'    ? '#ef4444' : '#f59e0b';

  return (
    <div onClick={() => setExpanded(p => !p)}
      style={{ borderBottom: '1px solid var(--tec-border)', cursor: 'pointer', transition: 'background 0.15s' }}>

      {/* Main Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'var(--sp-3) var(--sp-4)' }}>
        {/* Icon */}
        <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: `${cfg.color}15`, border: `1px solid ${cfg.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
          {cfg.icon}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-1)', fontWeight: 600 }}>
              {cfg.label}
            </span>
            <span style={{ fontSize: 9, fontWeight: 700, color: statusColor, background: `${statusColor}15`, border: `1px solid ${statusColor}30`, borderRadius: 20, padding: '1px 6px', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {payment.status}
            </span>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', marginTop: 2 }}>
            {new Date(payment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* Amount */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: positive ? '#22C55E' : 'var(--tec-text-1)', lineHeight: 1 }}>
            {positive ? '+' : '-'}{Number(payment.amount).toFixed(2)}π
          </div>
          <div style={{ fontSize: 10, color: 'var(--tec-text-3)', marginTop: 2 }}>
            {expanded ? '▲' : '▼'}
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div style={{ padding: '0 var(--sp-4) var(--sp-3) var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ height: 1, background: 'var(--tec-border)', marginBottom: 4 }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: 'var(--tec-surface-1)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 9, color: 'var(--tec-text-3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>Transaction ID</div>
              <div style={{ fontSize: 11, color: 'var(--tec-text-2)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {payment.id.slice(0, 16)}…
              </div>
            </div>
            <div style={{ background: 'var(--tec-surface-1)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 9, color: 'var(--tec-text-3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>Amount</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>
                {Number(payment.amount).toFixed(8)}π
              </div>
            </div>
          </div>

          {payment.txHash && (
            <div style={{ background: 'var(--tec-surface-1)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 9, color: 'var(--tec-text-3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>Tx Hash</div>
              <div style={{ fontSize: 10, color: 'var(--tec-text-2)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {payment.txHash}
              </div>
            </div>
          )}
        </div>
      )}
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
    const token   = getAccessToken();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const res = await fetch('/api/bff/wallet/balance', { credentials: 'include', cache: 'no-store' });
      if (res.ok) { const d = await res.json(); setBalance(Number(d.data?.balance ?? d.balance ?? 0)); }
    } catch {}

    try {
      setHistoryLoading(true);
      const res = await fetch('/api/bff/payments/history?limit=20&sort=desc', { credentials: 'include', cache: 'no-store' });
      if (res.ok) { const d = await res.json(); setPayments(d?.data?.payments ?? []); }
    } catch {} finally { setHistoryLoading(false); }

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
    { key: 'overview', label: 'Overview',  icon: '⊞' },
    { key: 'domains',  label: 'Ecosystem', icon: '🌐' },
    { key: 'activity', label: 'Activity',  icon: '📋' },
  ];

  return (
    <DashboardShell loading={isLoading || dataLoading}>

      {/* ── Welcome Banner ─────────────────────────────── */}
      {isNewUser && (
        <div className="tec-fade-in" style={{ padding: 'var(--sp-4) var(--sp-5)', background: 'linear-gradient(135deg, rgba(251,191,36,0.1), rgba(251,191,36,0.05))', border: '1px solid var(--tec-border-gold)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--sp-6)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>🎉</span>
          <div>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--tec-gold)' }}>Welcome to TEC Ecosystem</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)' }}>Your account is ready — explore 24 sovereign apps on Pi Network</div>
          </div>
        </div>
      )}

      {/* ── User Header ────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-6)', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        <div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', marginBottom: 4 }}>{t.dashboard.greeting}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#FBBF24,#F59E0B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: '#0a0800' }}>
              {user?.piUsername?.[0]?.toUpperCase()}
            </div>
            <div>
              <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--tec-text-1)', margin: 0 }}>@{user?.piUsername}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 10, color: 'var(--tec-text-3)', letterSpacing: 1 }}>{user?.role?.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {kycVerified !== null && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 'var(--radius-full)', background: kycVerified ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${kycVerified ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`, color: kycVerified ? '#22C55E' : '#ef4444' }}>
              {kycVerified ? '✓ KYC Verified' : '! KYC Pending'}
            </span>
          )}
          <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 'var(--radius-full)', background: 'var(--tec-gold-glow)', border: '1px solid var(--tec-border-gold)', color: 'var(--tec-gold)' }}>
            ◈ {user?.subscriptionPlan ?? 'Free'}
          </span>
          <button onClick={fetchData} className="tec-btn"
            style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--tec-surface-2)', border: '1px solid var(--tec-border)', color: 'var(--tec-text-2)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── Stats Grid ─────────────────────────────────── */}
      <div className="tec-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 'var(--sp-3)', marginBottom: 'var(--sp-6)' }}>
        <StatCard icon="π"  label="Pi Balance" value={balance !== null ? `${balance.toFixed(2)}π` : '—π'} sub="Wallet balance"         accent="var(--tec-gold)"     />
        <StatCard icon="📤" label="Pi Spent"   value={`${totalPiSpent.toFixed(2)}π`}                    sub={`${completedPayments.length} transactions`} accent="var(--tec-text-1)" />
        <StatCard icon="🚀" label="Live Apps"  value={`${LIVE_APPS.length}`}                             sub={`of ${LIVE_DOMAINS.length + COMING_SOON.length} total`} accent="#22C55E" />
        <StatCard icon="◈"  label="Plan"       value={user?.subscriptionPlan ?? 'Free'}                  sub={userPro ? 'Active subscription' : 'Upgrade available'} accent={userPro ? '#8b5cf6' : 'var(--tec-text-2)'} />
      </div>

      {/* ── Tabs ───────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)', borderBottom: '1px solid var(--tec-border)', paddingBottom: 'var(--sp-3)' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="tec-btn"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: activeTab === tab.key ? 700 : 400, color: activeTab === tab.key ? 'var(--tec-gold)' : 'var(--tec-text-3)', background: activeTab === tab.key ? 'var(--tec-gold-dim)' : 'transparent' }}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Overview Tab ───────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="tec-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>

          {/* Balance Chart */}
          <DashboardCard
            title="Spending — Last 7 Days"
            subtitle={`${completedPayments.length} completed payments`}
          >
            <BalanceChart payments={payments} />
          </DashboardCard>

          {/* Quick Actions */}
          <DashboardCard title="Quick Actions">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 'var(--sp-3)' }}>
              {[
                { label: 'Wallet',        icon: '💳', href: '/dashboard/wallet',        color: '#3b82f6' },
                { label: 'KYC',           icon: '🪪', href: '/dashboard/kyc',           color: '#22C55E' },
                { label: 'Subscription',  icon: '◈',  href: '/dashboard/subscription',  color: '#8b5cf6' },
                { label: 'Notifications', icon: '🔔', href: '/dashboard/notifications', color: '#f59e0b' },
              ].map(a => (
                <button key={a.label} onClick={() => router.push(a.href)} className="tec-btn"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'var(--sp-3) var(--sp-4)', background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                  <span style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: `${a.color}15`, border: `1px solid ${a.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{a.icon}</span>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--tec-text-1)' }}>{a.label}</span>
                </button>
              ))}
            </div>
          </DashboardCard>

          {/* Recent Activity Preview */}
          <DashboardCard
            title="Recent Activity"
            subtitle={`${payments.slice(0, 3).length} of ${payments.length}`}
            action={
              <button onClick={() => setActiveTab('activity')} className="tec-btn"
                style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                View all →
              </button>
            }
            padding="0"
          >
            {payments.length === 0 ? (
              <div style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--tec-text-3)' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
                <div style={{ fontSize: 'var(--text-sm)' }}>No transactions yet</div>
              </div>
            ) : (
              payments.slice(0, 3).map(p => <TxRow key={p.id} payment={p} />)
            )}
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
                  status={d.status} onClick={d.route ? () => openDomainRoute(d.route!) : undefined} />
              ))}
            </div>
          </DashboardCard>

          {/* Coming Soon */}
          <DashboardCard title="Coming Soon" subtitle={`${COMING_SOON.length} domains`}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(80px,1fr))', gap: 'var(--sp-2)' }}>
              {COMING_SOON.slice(0, 12).map(d => (
                <div key={d.slug} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 'var(--sp-3) var(--sp-2)', background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border)', borderRadius: 'var(--radius-md)', opacity: 0.5 }}>
                  <span style={{ fontSize: 20 }}>{d.emoji}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--tec-text-3)', textAlign: 'center' }}>{d.name.en}</span>
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>
      )}

      {/* ── Domains Tab ────────────────────────────────── */}
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

      {/* ── Activity Tab ───────────────────────────────── */}
      {activeTab === 'activity' && (
        <div className="tec-fade-in">
          <DashboardCard
            title="Transaction History"
            subtitle={`${payments.length} records`}
            action={
              <button onClick={() => router.push('/dashboard/wallet')} className="tec-btn"
                style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Wallet →
              </button>
            }
            padding="0"
          >
            {historyLoading ? (
              <div style={{ padding: 'var(--sp-8)', display: 'flex', justifyContent: 'center' }}>
                <div className="tec-spin" style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(251,191,36,0.15)', borderTopColor: 'var(--tec-gold)' }} />
              </div>
            ) : payments.length === 0 ? (
              <div style={{ padding: 'var(--sp-8)', textAlign: 'center', color: 'var(--tec-text-3)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                <div style={{ fontSize: 'var(--text-sm)' }}>No transactions yet</div>
              </div>
            ) : (
              <>
                {/* Summary Bar */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: 'var(--tec-border)', marginBottom: 1 }}>
                  {[
                    { label: 'Total',     value: payments.length,                                      color: 'var(--tec-text-1)' },
                    { label: 'Completed', value: completedPayments.length,                             color: '#22C55E'           },
                    { label: 'Volume',    value: `${totalPiSpent.toFixed(1)}π`,                        color: 'var(--tec-gold)'   },
                  ].map(s => (
                    <div key={s.label} style={{ padding: 'var(--sp-3)', background: 'var(--tec-surface-2)', textAlign: 'center' }}>
                      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 9, color: 'var(--tec-text-3)', letterSpacing: 1, textTransform: 'uppercase' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {payments.map(p => <TxRow key={p.id} payment={p} />)}
              </>
            )}
          </DashboardCard>
        </div>
      )}

    </DashboardShell>
  );
          }
