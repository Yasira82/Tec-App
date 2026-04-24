'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePiAuth }        from '@/lib-client/hooks/usePiAuth';
import { useTranslation }   from '@/lib/i18n';
import PiIntegration        from '@/components/PiIntegration';
import { getAccessToken }   from '@/lib-client/pi/pi-auth';
import { buildHeaders }     from '@/lib/request-id';
import styles               from './dashboard.module.css';

import { COMING_SOON } from '@/domains/_registry';

// ✅ من الـ Registry — Single Source of Truth
const TEC_APPS = COMING_SOON.map(d => ({
  name:   d.name.en,   // ✅ string بدل Localized
  domain: d.piDomain,
  emoji:  d.emoji,
}));

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

export default function DashboardPage() {
  const { user, isAuthenticated, isNewUser } = usePiAuth();
  const { t }  = useTranslation();
  const token  = getAccessToken();

  const [balance,        setBalance]        = useState<number | null>(null);
  const [payments,       setPayments]       = useState<Payment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.id || !isAuthenticated) return;

    try {
      const balRes = await fetch(`/api/wallet/balance?userId=${user.id}`, {
        credentials: 'include',
        headers:     buildHeaders(token),
      });
      if (balRes.ok) {
        const balData = await balRes.json();
        // ✅ Number() — يتعامل مع Decimal string من الـ DB
        setBalance(Number(balData.balance ?? 0));
      }
    } catch {
      // silent
    }

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
    } catch {
      // silent
    } finally {
      setHistoryLoading(false);
    }
  }, [user?.id, isAuthenticated, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const completedPayments = payments.filter(p => p.status === 'completed');
  // ✅ Number() — يتعامل مع Decimal string
  const totalPiSpent = completedPayments.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );

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
            // ✅ Number() — يضمن إن balance رقم
            value: balance !== null ? `${Number(balance).toFixed(2)} TEC` : '— TEC',
            sub:   t.dashboard.stats.tecWallet,
          },
          {
            label: 'Pi Spent',
            // ✅ Number() — يضمن إن totalPiSpent رقم
            value: `${Number(totalPiSpent).toFixed(3)} π`,
            sub:   `${completedPayments.length} transactions`,
          },
          {
            label: t.dashboard.stats.availableApps,
            value: '1 / 24',
            sub:   t.dashboard.stats.activeApp,
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
                      <p className={styles.historyDate}>
                        {formatDate(p.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className={styles.historyRight}>
                    <p
                      className={styles.historyAmount}
                      style={{ color: STATUS_COLORS[p.status] }}
                    >
                      {/* ✅ Number() — يتعامل مع Decimal string */}
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

      {/* ── Apps ── */}
      <section className={`${styles.appsSection} fade-up-2`}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t.dashboard.appsTitle}</h2>
          <span className={styles.sectionMeta}>{t.dashboard.appsCount}</span>
        </div>
        <div className={styles.appsGrid}>

          {/* TEC — Active */}
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
