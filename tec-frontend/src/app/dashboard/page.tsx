'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePiAuth }      from '@/lib-client/hooks/usePiAuth';
import { useTranslation } from '@/lib/i18n';
import PiIntegration      from '@/components/PiIntegration';
import { getAccessToken } from '@/lib-client/pi/pi-auth';
import { buildHeaders }   from '@/lib/request-id';
import styles             from './dashboard.module.css';

import {
  LIVE_DOMAINS,
  COMING_SOON,
  getDomainsByGroup,
} from '@/domains/_registry';

// ── Domain Groups from Registry ───────────────────────────
const LIVE_APPS     = LIVE_DOMAINS.filter(d => d.layer !== 'os');
const FINANCE       = getDomainsByGroup('finance');
const COMMERCE_APPS = getDomainsByGroup('commerce');
const REAL_WORLD    = getDomainsByGroup('real_world');
const SOCIAL        = getDomainsByGroup('social');
const TECH          = getDomainsByGroup('tech');
const MONETIZATION  = getDomainsByGroup('monetization');

interface Payment {
  id:             string;
  amount:         number | string;
  currency:       string;
  status:         'created' | 'approved' | 'completed' | 'cancelled' | 'failed';
  payment_method: string;
  created_at:     string;
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#7ee7c0',
  approved:  '#7eb8f7',
  created:   '#f0c040',
  cancelled: '#6b6b7a',
  failed:    '#e74c3c',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Domain Card ───────────────────────────────────────────
function DomainCard({
  emoji, name, domain, status, onClick,
}: {
  emoji:    string;
  name:     string;
  domain:   string;
  status:   'live' | 'beta' | 'coming_soon' | 'maintenance';
  onClick?: () => void;
}) {
  const isLive = status === 'live' || status === 'beta';
  return (
    <div
      className={`${styles.appCard} ${isLive ? styles.appCardActive : ''}`}
      onClick={onClick}
      style={{ opacity: isLive ? 1 : 0.6, cursor: onClick ? 'pointer' : 'default' }}
    >
      <span style={{ fontSize: '20px' }}>{emoji}</span>
      <div className={styles.appInfo}>
        <span className={styles.appName}>{name}</span>
        <span className={styles.appDomain}>{domain}</span>
      </div>
      {isLive
        ? <span className={styles.appLive}>Live</span>
        : <span className={styles.appSoon}>Soon</span>
      }
    </div>
  );
}

// ── Domain Group Section ──────────────────────────────────
function DomainGroup({
  title, emoji, domains,
}: {
  title:   string;
  emoji:   string;
  domains: typeof FINANCE;
}) {
  if (!domains.length) return null;
  return (
    <div className={styles.domainGroup}>
      <div className={styles.groupHeader}>
        <span>{emoji}</span>
        <span className={styles.groupTitle}>{title}</span>
        <span className={styles.groupCount}>{domains.length}</span>
      </div>
      <div className={styles.appsGrid}>
        {domains.map(d => (
          <DomainCard
            key={d.slug}
            emoji={d.emoji}
            name={d.name.en}
            domain={d.piDomain}
            status={d.status}
            onClick={
              d.route
                ? () => window.open(`https://${d.piDomain}`, '_blank', 'noopener,noreferrer')
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

// ── Dashboard Page ────────────────────────────────────────
export default function DashboardPage() {
  const { user, isAuthenticated, isNewUser } = usePiAuth();
  const { t }  = useTranslation();
  const token  = getAccessToken();

  const [balance,        setBalance]        = useState<number | null>(null);
  const [payments,       setPayments]       = useState<Payment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeTab,      setActiveTab]      = useState<'overview' | 'domains' | 'activity'>('overview');

  const fetchData = useCallback(async () => {
    if (!user?.id || !isAuthenticated) return;

    try {
      const balRes = await fetch(`/api/wallet/balance?userId=${user.id}`, {
        credentials: 'include',
        headers:     buildHeaders(token),
      });
      if (balRes.ok) {
        const balData = await balRes.json();
        setBalance(Number(balData.balance ?? 0));
      }
    } catch { /* silent */ }

    try {
      setHistoryLoading(true);
      const histRes = await fetch('/api/payments/history?limit=5&sort=desc', {
        credentials: 'include',
        headers:     buildHeaders(token),
      });
      if (histRes.ok) {
        const histData = await histRes.json();
        setPayments(histData?.data?.payments ?? []);
      }
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  }, [user?.id, isAuthenticated, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const completedPayments = payments.filter(p => p.status === 'completed');
  const totalPiSpent      = completedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const liveCount         = LIVE_APPS.length;
  const totalCount        = LIVE_DOMAINS.length + COMING_SOON.length;

  return (
    <>
      {/* ── Header ── */}
      <header className={styles.header}>
        {isNewUser && (
          <div className={`${styles.welcomeBanner} fade-up`}>
            {t.dashboard.welcomeNew}
          </div>
        )}
        <div className={styles.headerRow}>
          <div>
            <p className={styles.greeting}>{t.dashboard.greeting}</p>
            <h1 className={styles.username}>
              @{user?.piUsername}
              <span className={styles.roleBadge}>{user?.role}</span>
            </h1>
          </div>
          <div className={styles.planBadge}>
            ◈ {user?.subscriptionPlan || 'Free'}
          </div>
        </div>
      </header>

      {/* ── Stats ── */}
      <div className={`${styles.statsGrid} fade-up-1`}>
        {[
          {
            label: t.dashboard.stats.piBalance,
            value: balance !== null ? `${Number(balance).toFixed(2)} π` : '— π',
            sub:   t.dashboard.stats.tecWallet,
          },
          {
            label: 'Pi Spent',
            value: `${Number(totalPiSpent).toFixed(3)} π`,
            sub:   `${completedPayments.length} transactions`,
          },
          {
            label: 'Live Apps',
            value: `${liveCount} / ${totalCount}`,
            sub:   'domains active',
          },
          {
            label: t.dashboard.stats.subscription,
            value: user?.subscriptionPlan || 'Free',
            sub:   t.dashboard.stats.upgradePro,
          },
        ].map(s => (
          <div key={s.label} className={styles.statCard}>
            <p className={styles.statLabel}>{s.label}</p>
            <p className={`${styles.statValue} gold-text`}>{s.value}</p>
            <p className={styles.statSub}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className={`${styles.tabsBar} fade-up-1`}>
        {(['overview', 'domains', 'activity'] as const).map(tab => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'overview' ? '⊞ Overview' : tab === 'domains' ? '🌐 Domains' : '📋 Activity'}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <>
          <PiIntegration />

          {/* ── Live Apps ── */}
          <section className={`${styles.appsSection} fade-up-2`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span style={{ color: '#7ee7c0' }}>●</span> Live Apps
              </h2>
              <span className={styles.sectionMeta}>{liveCount} active</span>
            </div>
            <div className={styles.appsGrid}>
              {/* TEC OS */}
              <DomainCard
                emoji="🔷"
                name="TEC"
                domain="tec.pi"
                status="live"
                onClick={() => window.open('https://tec.pi', '_blank', 'noopener,noreferrer')}
              />
              {LIVE_APPS.map(d => (
                <DomainCard
                  key={d.slug}
                  emoji={d.emoji}
                  name={d.name.en}
                  domain={d.piDomain}
                  status={d.status}
                  onClick={
                    d.route
                      ? () => window.location.href = d.route!
                      : undefined
                  }
                />
              ))}
            </div>
          </section>

          {/* ── Coming Soon Preview ── */}
          <section className={`${styles.appsSection} fade-up-2`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Coming Soon</h2>
              <span className={styles.sectionMeta}>{COMING_SOON.length} domains</span>
            </div>
            <div className={styles.appsGrid}>
              {COMING_SOON.slice(0, 8).map(d => (
                <DomainCard
                  key={d.slug}
                  emoji={d.emoji}
                  name={d.name.en}
                  domain={d.piDomain}
                  status={d.status}
                />
              ))}
            </div>
            {COMING_SOON.length > 8 && (
              <button
                className={styles.btn}
                onClick={() => setActiveTab('domains')}
                style={{ marginTop: 12 }}
              >
                View all {COMING_SOON.length} domains →
              </button>
            )}
          </section>
        </>
      )}

      {/* ── Domains Tab ── */}
      {activeTab === 'domains' && (
        <section className={`${styles.appsSection} fade-up`}>
          <DomainGroup title="Finance"     emoji="💰" domains={FINANCE}       />
          <DomainGroup title="Commerce"    emoji="🛒" domains={COMMERCE_APPS} />
          <DomainGroup title="Real World"  emoji="🏙️" domains={REAL_WORLD}    />
          <DomainGroup title="Social"      emoji="🌍" domains={SOCIAL}        />
          <DomainGroup title="Tech"        emoji="⚡" domains={TECH}          />
          <DomainGroup title="Membership"  emoji="🏆" domains={MONETIZATION}  />
        </section>
      )}

      {/* ── Activity Tab ── */}
      {activeTab === 'activity' && (
        <section className={`${styles.historySection} fade-up`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Recent Transactions</h2>
            <span className={styles.sectionMeta}>{payments.length} records</span>
          </div>

          {historyLoading ? (
            <div className={styles.historyLoading}>
              <div className={styles.loadingSpinner} />
            </div>
          ) : payments.length === 0 ? (
            <div className={styles.emptyHistory}>
              <span>📭</span>
              <p>No transactions yet</p>
            </div>
          ) : (
            <div className={styles.historyList}>
              {payments.map(p => (
                <div key={p.id} className={styles.historyItem}>
                  <div className={styles.historyLeft}>
                    <span
                      className={styles.historyDot}
                      style={{ backgroundColor: STATUS_COLORS[p.status] }}
                    />
                    <div>
                      <p className={styles.historyMethod}>
                        {p.payment_method.toUpperCase()} Payment
                      </p>
                      <p className={styles.historyDate}>{formatDate(p.created_at)}</p>
                    </div>
                  </div>
                  <div className={styles.historyRight}>
                    <p className={styles.historyAmount} style={{ color: STATUS_COLORS[p.status] }}>
                      {Number(p.amount).toFixed(2)} π
                    </p>
                    <p className={styles.historyStatus}>{p.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
      }
