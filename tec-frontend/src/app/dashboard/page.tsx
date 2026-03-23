tec-frontend/src/app/dashboard/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePiAuth } from '@/lib-client/hooks/usePiAuth';
import { useTranslation } from '@/lib/i18n';
import PiIntegration from '@/components/PiIntegration';
import { fetchWithAuth } from '@/lib-client/pi/pi-auth';
import styles from './dashboard.module.css';

const TEC_APPS = [
  { name: 'Nexus',      domain: 'nexus.pi',      emoji: '🌐' },
  { name: 'Commerce',   domain: 'commerce.pi',   emoji: '🛒' },
  { name: 'Assets',     domain: 'assets.pi',     emoji: '💎' },
  { name: 'Fundx',      domain: 'fundx.pi',      emoji: '🏦' },
  { name: 'Estate',     domain: 'estate.pi',     emoji: '🏠' },
  { name: 'Analytics',  domain: 'analytics.pi',  emoji: '📊' },
  { name: 'Connection', domain: 'connection.pi', emoji: '🔗' },
  { name: 'Life',       domain: 'life.pi',       emoji: '❤️' },
  { name: 'Insure',     domain: 'insure.pi',     emoji: '🛡️' },
  { name: 'Vip',        domain: 'vip.pi',        emoji: '👑' },
  { name: 'Zone',       domain: 'zone.pi',       emoji: '🌎' },
  { name: 'Explorer',   domain: 'explorer.pi',   emoji: '✈️' },
  { name: 'Alert',      domain: 'alert.pi',      emoji: '🚨' },
  { name: 'System',     domain: 'system.pi',     emoji: '⚙️' },
  { name: 'Ecommerce',  domain: 'ecommerce.pi',  emoji: '🏬' },
  { name: 'Dx',         domain: 'dx.pi',         emoji: '🧪' },
  { name: 'Nx',         domain: 'nx.pi',         emoji: '🔧' },
  { name: 'Nbf',        domain: 'nbf.pi',        emoji: '💳' },
  { name: 'Epic',       domain: 'epic.pi',       emoji: '🔥' },
  { name: 'Legend',     domain: 'legend.pi',     emoji: '🌟' },
  { name: 'Titan',      domain: 'titan.pi',      emoji: '⚔️' },
  { name: 'Elite',      domain: 'elite.pi',      emoji: '🥇' },
  { name: 'Brookfield', domain: 'brookfield.pi', emoji: '🏢' },
];

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: 'created' | 'approved' | 'completed' | 'cancelled' | 'failed';
  payment_method: string;
  created_at: string;
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

export default function DashboardPage() {
  const { user, isAuthenticated, isNewUser } = usePiAuth();
  const { t } = useTranslation();
  const [balance, setBalance] = useState<number | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const gatewayUrl = process.env.NEXT_PUBLIC_API_GATEWAY_URL;

  const fetchData = useCallback(async () => {
    if (!user?.id || !isAuthenticated) return;

    // Fetch balance
    try {
      const balRes = await fetch(`/api/wallet/balance?userId=${user.id}`);
      if (balRes.ok) {
        const balData = await balRes.json();
        setBalance(balData.balance ?? 0);
      }
    } catch (err) {
      console.error('Balance fetch error:', err);
    }

    // Fetch payment history
    try {
      setHistoryLoading(true);
      const histRes = await fetchWithAuth(
        `${gatewayUrl}/api/payments/history?limit=5&sort=desc`
      );
      if (histRes.ok) {
        const histData = await histRes.json();
        setPayments(histData?.data?.payments ?? []);
      }
    } catch (err) {
      console.error('History fetch error:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [user?.id, isAuthenticated, gatewayUrl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const completedPayments = payments.filter(p => p.status === 'completed');
  const totalPiSpent = completedPayments.reduce((sum, p) => sum + p.amount, 0);

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
          <div className={styles.planBadge}>◈ {user?.subscriptionPlan || 'Free'}</div>
        </div>
      </header>

      {/* ── Stats ── */}
      <div className={`${styles.statsGrid} fade-up-1`}>
        {[
          {
            label: t.dashboard.stats.piBalance,
            value: balance !== null ? `${balance.toFixed(2)} TEC` : '— TEC',
            sub: t.dashboard.stats.tecWallet,
          },
          {
            label: 'Pi Spent',
            value: `${totalPiSpent.toFixed(3)} π`,
            sub: `${completedPayments.length} transactions`,
          },
          {
            label: t.dashboard.stats.availableApps,
            value: '1 / 24',
            sub: t.dashboard.stats.activeApp,
          },
          {
            label: t.dashboard.stats.subscription,
            value: user?.subscriptionPlan || 'Free',
            sub: t.dashboard.stats.upgradePro,
          },
        ].map(s => (
          <div key={s.label} className={styles.statCard}>
            <p className={styles.statLabel}>{s.label}</p>
            <p className={`${styles.statValue} gold-text`}>{s.value}</p>
            <p className={styles.statSub}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Pi Integration ── */}
      <PiIntegration />

      {/* ── Recent Transactions ── */}
      {isAuthenticated && (
        <section className={`${styles.historySection} fade-up-2`}>
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
                    <p
                      className={styles.historyAmount}
                      style={{ color: STATUS_COLORS[p.status] }}
                    >
                      {p.amount} π
                    </p>
                    <p className={styles.historyStatus}>{p.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Apps ── */}
      <section className={`${styles.appsSection} fade-up-2`}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t.dashboard.appsTitle}</h2>
          <span className={styles.sectionMeta}>{t.dashboard.appsCount}</span>
        </div>
        <div className={styles.appsGrid}>
          {/* TEC - Active */}
          <div
            className={`${styles.appCard} ${styles.appCardActive}`}
            onClick={() => window.open('https://tec.pi', '_blank', 'noopener,noreferrer')}
          >
            <span style={{ fontSize: '20px' }}>🔷</span>
            <div className={styles.appInfo}>
              <span className={styles.appName}>{t.common.appName}</span>
              <span className={styles.appDomain}>tec.pi</span>
            </div>
            <span className={styles.appLive}>{t.common.live}</span>
          </div>

          {/* Other Apps */}
          {TEC_APPS.map(app => (
            <div
              key={app.name}
              className={styles.appCard}
              onClick={() => window.open(`https://${app.domain}`, '_blank', 'noopener,noreferrer')}
            >
              <span style={{ fontSize: '20px' }}>{app.emoji}</span>
              <div className={styles.appInfo}>
                <span className={styles.appName}>{app.name}</span>
                <span className={styles.appDomain}>{app.domain}</span>
              </div>
              <span className={styles.appSoon}>{t.common.comingSoon}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
