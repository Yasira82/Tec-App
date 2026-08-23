'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useRouter }                                   from 'next/navigation';
import { usePiAuth }                                   from '@/lib-client/hooks/usePiAuth';
import { useSubscriptionPlan }                         from '@/lib-client/hooks/useSubscriptionPlan';
import { useTranslation }                              from '@/lib/i18n';
import { log, reportError }                            from '@/lib/observability';
import { normalizePayment, formatTxDate, isKycVerified, type Payment } from '@/lib/dashboard-data';
import { DashboardShell, DashboardCard }               from '@/components/dashboard';
import { HubAppsGrid }                                  from '@/components/hub';
import { LIVE_DOMAINS, COMING_SOON }                   from '@/domains/_registry';
import { iconOf, accentOf }                            from '@/domains/_categories';
import { Icon }                                        from '@/components/ui/Icon';

/** Fill a "{n}" placeholder in an i18n string (word order-safe for RTL). */
const fmt = (s: string, n: number | string) => s.replace('{n}', String(n));

/** Display label for a plan id ('ENTERPRISE' → 'Enterprise'). */
const planName = (plan: string, freeLabel: string) =>
  plan === 'FREE' ? freeLabel : plan.charAt(0) + plan.slice(1).toLowerCase();

type TabKey = 'overview' | 'domains' | 'activity';

// ── Domain stat helper ─────────────────────────────────────
// Apps = live domains EXCLUDING the OS layer (TEC/Hub itself is the platform, not an
// app in its own grid). The stat card counted the OS layer too, so it read 24 while
// the grid rendered 23 — two different numbers for the same thing on one screen.
const LIVE_APPS = LIVE_DOMAINS.filter(d => d.status === 'live' && d.layer !== 'os');

// Map a registry domain → the SAME HubApp shape the Hub feeds to <HubAppsGrid>,
// so the Dashboard renders the identical polished launcher grid (one component,
// one open behavior). External (http) apps go through Hub SSO so they land WITH a
// session; internal routes navigate directly — the fix for apps that "opened wrong".
function toHubApp(d: (typeof LIVE_DOMAINS)[number]) {
  const route = d.route ?? `/${d.slug}`;
  const href  = route.startsWith('http')
    ? `/api/auth/sso?target=${encodeURIComponent(route)}`
    : route;
  return { slug: d.slug, name: d.name.en, emoji: d.emoji, href, desc: d.description?.en ?? '', group: d.group };
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

// ── Balance Chart (SVG) — spent vs received, last 7 days ────
const INFLOW_TYPES = ['credit', 'receive', 'refund', 'deposit'];

function BalanceChart({ payments, noDataLabel, spentLabel, receivedLabel, locale }: {
  payments: Payment[]; noDataLabel: string; spentLabel: string; receivedLabel: string; locale: string;
}) {
  const W = 340; const H = 108; const PAD = { t: 10, r: 10, b: 24, l: 36 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  // Build daily spent (outflow) + received (inflow) from completed payments.
  const chartData = useMemo(() => {
    const days: { label: string; spent: number; received: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toDateString();
      const label = d.toLocaleDateString(locale, { weekday: 'short' });
      let spent = 0, received = 0;
      payments
        .filter(p => {
          if (p.status !== 'completed') return false;
          const t = new Date(p.createdAt);
          return !Number.isNaN(t.getTime()) && t.toDateString() === key;
        })
        .forEach(p => {
          const amt = Number(p.amount);
          if (INFLOW_TYPES.includes((p.type ?? '').toLowerCase())) received += amt;
          else spent += amt;
        });
      days.push({ label, spent, received });
    }
    return days;
  }, [payments, locale]);

  const maxVal = Math.max(...chartData.flatMap(d => [d.spent, d.received]), 1);
  const xOf = (i: number) => PAD.l + (i / (chartData.length - 1)) * innerW;
  const yOf = (v: number) => PAD.t + innerH - (v / maxVal) * innerH;

  const seriesPolyline = (key: 'spent' | 'received') =>
    chartData.map((d, i) => `${xOf(i)},${yOf(d[key])}`).join(' ');

  const hasData = chartData.some(d => d.spent > 0 || d.received > 0);

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--tec-text-3)' }}>
          <span style={{ width: 10, height: 3, borderRadius: 2, background: 'var(--tec-gold)' }} />{spentLabel}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--tec-text-3)' }}>
          <span style={{ width: 10, height: 3, borderRadius: 2, background: '#22C55E' }} />{receivedLabel}
        </span>
      </div>

      {!hasData ? (
        <div style={{ height: H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <span style={{ fontSize: 24, opacity: 0.3 }}>📊</span>
          <span style={{ fontSize: 11, color: 'var(--tec-text-3)' }}>{noDataLabel}</span>
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

          {/* Spent area + line */}
          <polygon
            points={[`${PAD.l},${PAD.t + innerH}`, ...chartData.map((d, i) => `${xOf(i)},${yOf(d.spent)}`), `${PAD.l + innerW},${PAD.t + innerH}`].join(' ')}
            fill="url(#gold-grad)" opacity={0.15} />
          <polyline points={seriesPolyline('spent')} fill="none" stroke="var(--tec-gold)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

          {/* Received line */}
          <polyline points={seriesPolyline('received')} fill="none" stroke="#22C55E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 0" />

          <defs>
            <linearGradient id="gold-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--tec-gold)" stopOpacity={1} />
              <stop offset="100%" stopColor="var(--tec-gold)" stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Dots + X labels */}
          {chartData.map((d, i) => (
            <g key={i}>
              {d.spent    > 0 && <circle cx={xOf(i)} cy={yOf(d.spent)}    r={3.5} fill="var(--tec-gold)" />}
              {d.received > 0 && <circle cx={xOf(i)} cy={yOf(d.received)} r={3.5} fill="#22C55E" />}
              <text x={xOf(i)} y={H - 4} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.4)">
                {d.label}
              </text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

// ── Transaction Type Config (icon + color; label comes from i18n) ──
const TX_CONFIG: Record<string, { icon: string; color: string }> = {
  payment:   { icon: '💳', color: 'var(--tec-gold)' },
  receive:   { icon: '📥', color: '#22C55E' },
  credit:    { icon: '📥', color: '#22C55E' },
  debit:     { icon: '📤', color: '#ef4444' },
  transfer:  { icon: '↔️', color: '#3b82f6' },
  refund:    { icon: '↩️', color: '#8b5cf6' },
  withdraw:  { icon: '📤', color: 'var(--tec-gold-dark)' },
  deposit:   { icon: '📥', color: '#22C55E' },
};

interface TxLabels {
  txLabels: Record<string, string>;
  detail:   { txId: string; amount: string; txHash: string };
  locale:   string;
}

// ── Transaction Row (Enhanced) ─────────────────────────────
function TxRow({ payment, txLabels, detail, locale }: { payment: Payment } & TxLabels) {
  const [expanded, setExpanded] = useState(false);
  const type    = payment.type?.toLowerCase() ?? '';
  const meta    = TX_CONFIG[type] ?? { icon: '🔄', color: 'var(--tec-text-3)' };
  const cfg     = { ...meta, label: txLabels[type] ?? payment.type };
  const positive = ['credit', 'receive', 'refund', 'deposit'].includes(type);

  const statusColor = payment.status === 'completed' ? '#22C55E'
    : payment.status === 'failed'    ? '#ef4444' : 'var(--tec-gold-dark)';

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
          {formatTxDate(payment.createdAt, locale) && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', marginTop: 2 }}>
              {formatTxDate(payment.createdAt, locale)}
            </div>
          )}
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
              <div style={{ fontSize: 9, color: 'var(--tec-text-3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>{detail.txId}</div>
              <div style={{ fontSize: 11, color: 'var(--tec-text-2)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {payment.id.slice(0, 16)}…
              </div>
            </div>
            <div style={{ background: 'var(--tec-surface-1)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 9, color: 'var(--tec-text-3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>{detail.amount}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>
                {Number(payment.amount).toFixed(8)}π
              </div>
            </div>
          </div>

          {payment.txHash && (
            <div style={{ background: 'var(--tec-surface-1)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 9, color: 'var(--tec-text-3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>{detail.txHash}</div>
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
  const { t, dir, locale } = useTranslation();
  const router = useRouter();

  const [balance,        setBalance]        = useState<number | null>(null);
  const [payments,       setPayments]       = useState<Payment[]>([]);
  const [kycVerified,    setKycVerified]    = useState<boolean | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [dataLoading,    setDataLoading]    = useState(true);
  const [hasLoaded,      setHasLoaded]      = useState(false);  // first load done → refresh keeps content
  const [loadError,      setLoadError]      = useState(false);  // a fetch failed (C-96: surfaced, not silent)
  const [activeTab,      setActiveTab]      = useState<TabKey>('overview');

  // Real plan from commerce (NOT the auth session — /me never carries it). Fail closed.
  const sub       = useSubscriptionPlan();
  const planLabel = planName(sub.plan, t.dashboard.header.free);
  const userPro   = sub.isPaid;
  const isNewUser = user && !payments.length;

  // The SAME filter the Hub uses — every live app, minus the OS layer (TEC itself).
  // Deliberately NOT getVisibleDomains(): client-side KYC/Pro gating hid apps from
  // users who actually qualify (a verified user was shown 21 of 23 because the KYC
  // flag read false). Gating stays enforced by each app and its services (P6).
  const visibleLive = LIVE_DOMAINS.filter(d => d.status === 'live' && d.layer !== 'os');

  // Same feed the Hub gives <HubAppsGrid> — Dashboard renders the identical grid.
  const hubApps = visibleLive.map(toHubApp);

  const fetchData = useCallback(async () => {
    if (!user?.id || !isAuthenticated) return;
    setDataLoading(true);
    let failed = false;

    // Each source fails independently (partial data is still useful); a failure is
    // logged + surfaced (C-96 — never a silent catch), never crashes the page.
    try {
      const res = await fetch('/api/bff/wallet/balance', { credentials: 'include', cache: 'no-store' });
      if (res.ok) { const d = await res.json(); setBalance(Number(d.data?.balance ?? d.balance ?? 0)); }
      else throw new Error(`balance ${res.status}`);
    } catch (e) { failed = true; reportError(e, { scope: 'dashboard.balance' }); }

    try {
      setHistoryLoading(true);
      const res = await fetch('/api/bff/payments/history?limit=20&sort=desc', { credentials: 'include', cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        const rows = (d?.data?.payments ?? d?.data ?? []) as Record<string, unknown>[];
        setPayments(Array.isArray(rows) ? rows.map(normalizePayment) : []);
      }
      else throw new Error(`history ${res.status}`);
    } catch (e) { failed = true; reportError(e, { scope: 'dashboard.history' }); }
    finally { setHistoryLoading(false); }

    try {
      const res = await fetch('/api/bff/kyc/status', { credentials: 'include', cache: 'no-store' });
      if (res.ok) setKycVerified(isKycVerified(await res.json()));
      else throw new Error(`kyc ${res.status}`);
    } catch (e) { failed = true; reportError(e, { scope: 'dashboard.kyc' }); }

    setLoadError(failed);
    if (!failed) log.info('dashboard.data.loaded', { user: user.id });
    setDataLoading(false);
    setHasLoaded(true);
  }, [user?.id, isAuthenticated]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const completedPayments = payments.filter(p => p.status === 'completed');
  const totalPiSpent      = completedPayments.reduce((s, p) => s + Number(p.amount), 0);
  const refreshing        = dataLoading && hasLoaded;  // background refresh (keep content)

  // Refresh reloads the plan too, so a just-completed upgrade shows without a reload.
  const refreshAll = useCallback(() => { fetchData(); sub.refresh(); }, [fetchData, sub]);

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'overview', label: t.dashboard.tabs.overview,  icon: '⊞' },
    { key: 'domains',  label: t.dashboard.tabs.ecosystem, icon: '🌐' },
    { key: 'activity', label: t.dashboard.tabs.activity,  icon: '📋' },
  ];

  // Localized transaction labels (type → label) + detail field labels for TxRow.
  const txLabels: Record<string, string> = {
    payment: t.dashboard.tx.payment, receive: t.dashboard.tx.received, credit: t.dashboard.tx.credit,
    debit: t.dashboard.tx.debit, transfer: t.dashboard.tx.transfer, refund: t.dashboard.tx.refund,
    withdraw: t.dashboard.tx.withdraw, deposit: t.dashboard.tx.deposit,
  };
  const txDetail = { txId: t.dashboard.activity.txId, amount: t.dashboard.activity.amount, txHash: t.dashboard.activity.txHash };

  return (
    <DashboardShell dir={dir} loading={isLoading || (dataLoading && !hasLoaded)}>

      {/* ── Welcome Banner ─────────────────────────────── */}
      {isNewUser && (
        <div className="tec-fade-in" style={{ padding: 'var(--sp-4) var(--sp-5)', background: 'linear-gradient(135deg, rgba(var(--tec-gold-rgb),0.1), rgba(var(--tec-gold-rgb),0.05))', border: '1px solid var(--tec-border-gold)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--sp-6)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>🎉</span>
          <div>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--tec-gold)' }}>{t.dashboard.welcomeTitle}</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)' }}>{t.dashboard.welcomeSub}</div>
          </div>
        </div>
      )}

      {/* ── User Header ────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-6)', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        <div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', marginBottom: 4 }}>{t.dashboard.greeting}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,var(--tec-gold),var(--tec-gold-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: '#0a0800' }}>
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
              {kycVerified ? t.dashboard.header.kycVerified : t.dashboard.header.kycPending}
            </span>
          )}
          <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 'var(--radius-full)', background: 'var(--tec-gold-glow)', border: '1px solid var(--tec-border-gold)', color: 'var(--tec-gold)' }}>
            ◈ {planLabel}
          </span>
          <button onClick={refreshAll} disabled={refreshing} className="tec-btn"
            style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--tec-surface-2)', border: '1px solid var(--tec-border)', color: 'var(--tec-text-2)', fontSize: 'var(--text-sm)', cursor: refreshing ? 'default' : 'pointer', opacity: refreshing ? 0.6 : 1 }}>
            {refreshing ? '⟳' : '↻'} {t.dashboard.header.refresh}
          </button>
        </div>
      </div>

      {/* ── Load-error banner (C-96 — surfaced, not silent) ── */}
      {loadError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'var(--sp-3) var(--sp-4)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--sp-5)' }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--tec-text-2)' }}>{t.dashboard.errors.loadFailed}</span>
          <button onClick={refreshAll} disabled={refreshing} className="tec-btn"
            style={{ padding: '5px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: refreshing ? 'default' : 'pointer' }}>
            {t.dashboard.errors.retry}
          </button>
        </div>
      )}

      {/* ── Stats Grid ─────────────────────────────────── */}
      <div className="tec-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 'var(--sp-3)', marginBottom: 'var(--sp-6)' }}>
        <StatCard icon="π"  label={t.dashboard.stats.piBalance} value={balance !== null ? `${balance.toFixed(2)}π` : '—π'} sub={t.dashboard.stats.walletBalance} accent="var(--tec-gold)" />
        <StatCard icon="📤" label={t.dashboard.stats.piSpent}   value={`${totalPiSpent.toFixed(2)}π`}                    sub={`${completedPayments.length} ${t.dashboard.stats.transactions}`} accent="var(--tec-text-1)" />
        <StatCard icon="🚀" label={t.dashboard.stats.liveApps}  value={`${LIVE_APPS.length}`}                             sub={fmt(t.dashboard.stats.ofTotal, LIVE_DOMAINS.length + COMING_SOON.length)} accent="#22C55E" />
        <StatCard icon="◈"  label={t.dashboard.stats.plan}      value={planLabel} sub={userPro ? t.dashboard.stats.activeSub : t.dashboard.stats.upgradeAvail} accent={userPro ? '#8b5cf6' : 'var(--tec-text-2)'} />
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
            title={t.dashboard.chart.title}
            subtitle={fmt(t.dashboard.chart.completed, completedPayments.length)}
          >
            <BalanceChart payments={payments} locale={locale}
              noDataLabel={completedPayments.length ? t.dashboard.chart.noneInWindow : t.dashboard.chart.noData}
              spentLabel={t.dashboard.stats.piSpent}
              receivedLabel={t.dashboard.tx.received} />
          </DashboardCard>

          {/* Quick Actions */}
          <DashboardCard title={t.dashboard.overview.quickActions}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 'var(--sp-3)' }}>
              {[
                { label: t.dashboard.overview.wallet,        icon: '💳', href: '/dashboard/wallet',        color: '#3b82f6' },
                { label: t.dashboard.overview.kyc,           icon: '🪪', href: '/dashboard/kyc',           color: '#22C55E' },
                { label: t.dashboard.overview.subscription,  icon: '◈',  href: '/dashboard/subscription',  color: '#8b5cf6' },
                { label: t.dashboard.overview.notifications, icon: '🔔', href: '/dashboard/notifications', color: 'var(--tec-gold-dark)' },
              ].map(a => (
                <button key={a.href} onClick={() => router.push(a.href)} className="tec-btn"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'var(--sp-3) var(--sp-4)', background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: dir === 'rtl' ? 'right' : 'left', width: '100%' }}>
                  <span style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: `${a.color}15`, border: `1px solid ${a.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{a.icon}</span>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--tec-text-1)' }}>{a.label}</span>
                </button>
              ))}
            </div>
          </DashboardCard>

          {/* Pro upsell — only for non-Pro users */}
          {!userPro && (
            <button onClick={() => router.push('/dashboard/subscription')} className="tec-btn"
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'var(--sp-4) var(--sp-5)', width: '100%', textAlign: dir === 'rtl' ? 'right' : 'left', background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.05))', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 'var(--radius-lg)', cursor: 'pointer' }}>
              <span style={{ fontSize: 24 }}>◈</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: '#a78bfa' }}>{t.dashboard.pro.title}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>{t.dashboard.pro.desc}</div>
              </div>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, padding: '6px 14px', borderRadius: 'var(--radius-full)', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)', color: '#a78bfa', flexShrink: 0 }}>
                {t.dashboard.pro.cta} {dir === 'rtl' ? '←' : '→'}
              </span>
            </button>
          )}

          {/* Recent Activity Preview */}
          <DashboardCard
            title={t.dashboard.overview.recentActivity}
            subtitle={`${payments.slice(0, 3).length} / ${payments.length}`}
            action={
              <button onClick={() => setActiveTab('activity')} className="tec-btn"
                style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                {t.dashboard.overview.viewAll} {dir === 'rtl' ? '←' : '→'}
              </button>
            }
            padding="0"
          >
            {payments.length === 0 ? (
              <div style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--tec-text-3)' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
                <div style={{ fontSize: 'var(--text-sm)' }}>{t.dashboard.overview.noTx}</div>
              </div>
            ) : (
              payments.slice(0, 3).map(p => <TxRow key={p.id} payment={p} txLabels={txLabels} detail={txDetail} locale={locale} />)
            )}
          </DashboardCard>

          {/* Live Apps — launcher-tile preview matching the Hub (tap → Hub to launch) */}
          <DashboardCard
            title={t.dashboard.overview.liveApps}
            subtitle={fmt(t.dashboard.overview.active, hubApps.length)}
            action={
              <button onClick={() => setActiveTab('domains')} className="tec-btn"
                style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                {t.dashboard.overview.viewAll} {dir === 'rtl' ? '←' : '→'}
              </button>
            }
          >
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', marginBottom: 'var(--sp-3)' }}>{t.dashboard.overview.hubHint}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
              {hubApps.slice(0, 8).map(app => (
                <button key={app.slug} onClick={() => router.push('/hub')} className="tec-btn"
                  style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '10px 2px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <div style={{ width: 54, height: 54, borderRadius: 17, background: 'linear-gradient(135deg, rgba(var(--tec-gold-rgb),0.18), rgba(var(--tec-gold-rgb),0.05))', border: '1px solid rgba(var(--tec-gold-rgb),0.28)', boxShadow: '0 4px 14px rgba(var(--tec-gold-rgb),0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={iconOf(app.slug)} size={26} color={accentOf(app.slug)} strokeWidth={1.8} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.82)', textAlign: 'center', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {app.name}
                  </span>
                </button>
              ))}
            </div>
          </DashboardCard>

          {/* Coming Soon */}
          <DashboardCard title={t.dashboard.overview.comingSoon} subtitle={fmt(t.dashboard.overview.domains, COMING_SOON.length)}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--sp-2)' }}>
              {COMING_SOON.slice(0, 12).map(d => (
                <div key={d.slug} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 'var(--sp-3) var(--sp-2)', background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border)', borderRadius: 'var(--radius-md)', opacity: 0.5 }}>
                  <Icon name={iconOf(d.slug)} size={20} color="var(--tec-text-3)" strokeWidth={1.8} />
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
          {/* Identical polished launcher grid to the Hub — one component, one source */}
          <DashboardCard title={t.dashboard.ecosystem.title} subtitle={fmt(t.dashboard.ecosystem.total, LIVE_DOMAINS.length + COMING_SOON.length)} padding="0">
            <HubAppsGrid apps={hubApps} openTo="/hub" />
          </DashboardCard>

          {/* Coming Soon */}
          <div style={{ marginTop: 'var(--sp-5)' }}>
            <DashboardCard title={t.dashboard.overview.comingSoon} subtitle={fmt(t.dashboard.overview.domains, COMING_SOON.length)}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--sp-2)' }}>
                {COMING_SOON.map(d => (
                  <div key={d.slug} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 'var(--sp-3) var(--sp-2)', background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border)', borderRadius: 'var(--radius-md)', opacity: 0.5 }}>
                    <Icon name={iconOf(d.slug)} size={20} color="var(--tec-text-3)" strokeWidth={1.8} />
                    <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--tec-text-3)', textAlign: 'center' }}>{d.name.en}</span>
                  </div>
                ))}
              </div>
            </DashboardCard>
          </div>
        </div>
      )}

      {/* ── Activity Tab ───────────────────────────────── */}
      {activeTab === 'activity' && (
        <div className="tec-fade-in">
          <DashboardCard
            title={t.dashboard.activity.title}
            subtitle={fmt(t.dashboard.activity.records, payments.length)}
            action={
              <button onClick={() => router.push('/dashboard/wallet')} className="tec-btn"
                style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                {t.dashboard.activity.wallet} {dir === 'rtl' ? '←' : '→'}
              </button>
            }
            padding="0"
          >
            {historyLoading ? (
              <div style={{ padding: 'var(--sp-8)', display: 'flex', justifyContent: 'center' }}>
                <div className="tec-spin" style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(var(--tec-gold-rgb),0.15)', borderTopColor: 'var(--tec-gold)' }} />
              </div>
            ) : payments.length === 0 ? (
              <div style={{ padding: 'var(--sp-8)', textAlign: 'center', color: 'var(--tec-text-3)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                <div style={{ fontSize: 'var(--text-sm)' }}>{t.dashboard.activity.noTx}</div>
              </div>
            ) : (
              <>
                {/* Summary Bar */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: 'var(--tec-border)', marginBottom: 1 }}>
                  {[
                    { label: t.dashboard.activity.total,     value: payments.length,               color: 'var(--tec-text-1)' },
                    { label: t.dashboard.activity.completed, value: completedPayments.length,      color: '#22C55E'           },
                    { label: t.dashboard.activity.volume,    value: `${totalPiSpent.toFixed(1)}π`, color: 'var(--tec-gold)'   },
                  ].map(s => (
                    <div key={s.label} style={{ padding: 'var(--sp-3)', background: 'var(--tec-surface-2)', textAlign: 'center' }}>
                      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 9, color: 'var(--tec-text-3)', letterSpacing: 1, textTransform: 'uppercase' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {payments.map(p => <TxRow key={p.id} payment={p} txLabels={txLabels} detail={txDetail} locale={locale} />)}
              </>
            )}
          </DashboardCard>
        </div>
      )}

    </DashboardShell>
  );
          }
