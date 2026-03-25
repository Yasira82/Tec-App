'use client';

import { useNotifications, Notification, NotifType } from '@/lib-client/hooks/useNotifications';
import styles from './notifications.module.css';

// ─── Helpers ──────────────────────────────────────────────────
function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);

  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const TYPE_CONFIG: Record<NotifType, { icon: string; css: string }> = {
  PAYMENT:  { icon: '💳', css: 'typePayment'  },
  WALLET:   { icon: '💰', css: 'typeWallet'   },
  KYC:      { icon: '🪪', css: 'typeKyc'      },
  SECURITY: { icon: '🔒', css: 'typeSecurity' },
  SYSTEM:   { icon: '⚙️', css: 'typeSystem'   },
};

// ─── Page ──────────────────────────────────────────────────────
export default function NotificationsPage() {
  const {
    notifications, unreadCount,
    isLoading, isRefreshing, error,
    refetch, markAsRead, markAllAsRead,
  } = useNotifications();

  if (isLoading) {
    return (
      <div className={styles.container}>
        <NotifSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <span>⚠️</span>
          <p>{error}</p>
          <button className={styles.btn} onClick={refetch}>إعادة المحاولة</button>
        </div>
      </div>
    );
  }

  const unread = notifications.filter(n => !n.read);
  const read   = notifications.filter(n => n.read);

  return (
    <div className={styles.container}>

      {/* ── Header ── */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Notifications</h1>
          <p className={styles.subtitle}>
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
              : 'All caught up ✓'}
          </p>
        </div>
        <div className={styles.headerRight}>
          {isRefreshing && <span className={styles.refreshing}>⟳ Refreshing...</span>}
          {unreadCount > 0 && (
            <button className={styles.btnOutline} onClick={markAllAsRead}>
              Mark all as read
            </button>
          )}
          <button className={styles.btn} onClick={refetch}>↻</button>
        </div>
      </header>

      {/* ── Empty State ── */}
      {notifications.length === 0 && (
        <div className={styles.emptyState}>
          <span>🔔</span>
          <p>No notifications yet</p>
        </div>
      )}

      {/* ── Unread ── */}
      {unread.length > 0 && (
        <section className={`${styles.section} fade-up`}>
          <div className={styles.sectionLabel}>
            <span>Unread</span>
            <span className={styles.badge}>{unread.length}</span>
          </div>
          <div className={styles.list}>
            {unread.map(n => (
              <NotifCard
                key={n.id}
                notif={n}
                onRead={() => markAsRead(n.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Read ── */}
      {read.length > 0 && (
        <section className={`${styles.section} fade-up-1`}>
          {unread.length > 0 && (
            <div className={styles.sectionLabel}>
              <span>Earlier</span>
            </div>
          )}
          <div className={styles.list}>
            {read.map(n => (
              <NotifCard key={n.id} notif={n} />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

// ─── NotifCard ──────────────────────────────────────────────────
function NotifCard({
  notif,
  onRead,
}: {
  notif:   Notification;
  onRead?: () => void;
}) {
  const cfg = TYPE_CONFIG[notif.type];

  return (
    <div
      className={`${styles.card} ${!notif.read ? styles.cardUnread : ''}`}
      onClick={!notif.read ? onRead : undefined}
    >
      <div className={`${styles.iconWrap} ${styles[cfg.css]}`}>
        {cfg.icon}
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <span className={styles.cardTitle}>{notif.title}</span>
          <span className={styles.cardTime}>{formatDate(notif.created_at)}</span>
        </div>
        <p className={styles.cardMsg}>{notif.message}</p>
      </div>
      {!notif.read && <div className={styles.unreadDot} />}
    </div>
  );
}

function NotifSkeleton() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skeletonHeader} />
      {[1, 2, 3, 4].map(i => (
        <div key={i} className={styles.skeletonCard} />
      ))}
    </div>
  );
}
