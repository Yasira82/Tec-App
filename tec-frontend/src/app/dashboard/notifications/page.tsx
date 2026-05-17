'use client';

import { useNotifications, Notification, NotifType } from '@/lib-client/hooks/useNotifications';
import { DashboardShell, DashboardCard }              from '@/components/dashboard';

// ── Helpers ────────────────────────────────────────────────────
function formatDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins <  1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs  < 24) return `${hrs}h ago`;
  if (days <  7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const TYPE_CONFIG: Record<NotifType, { icon: string; color: string; bg: string }> = {
  PAYMENT:  { icon: '💳', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)'  },
  WALLET:   { icon: '💰', color: '#d4af37', bg: 'rgba(212,175,55,0.1)'  },
  KYC:      { icon: '🪪', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)'  },
  SECURITY: { icon: '🔒', color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   },
  SYSTEM:   { icon: '⚙️', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
};

// ── Notification Card ──────────────────────────────────────────
function NotifCard({ notif, onRead }: {
  notif: Notification; onRead: (id: string) => void;
}) {
  const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.SYSTEM;

  return (
    <div
      onClick={() => !notif.read && onRead(notif.id)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)',
        padding: 'var(--sp-4) var(--sp-5)',
        borderBottom: '1px solid var(--tec-border)',
        background: notif.read ? 'transparent' : 'rgba(212,175,55,0.03)',
        cursor: notif.read ? 'default' : 'pointer',
        transition: 'background 0.15s ease',
      }}>

      {/* Icon */}
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: cfg.bg, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 16,
      }}>
        {cfg.icon}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: notif.read ? 400 : 600, color: 'var(--tec-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {notif.title}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {formatDate(notif.created_at)}
          </div>
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', lineHeight: 1.5 }}>
          {notif.message}
        </div>
        <div style={{ marginTop: 6 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
            color: cfg.color, background: cfg.bg,
            padding: '2px 8px', borderRadius: 'var(--radius-full)',
            textTransform: 'uppercase',
          }}>
            {notif.type}
          </span>
        </div>
      </div>

      {/* Unread dot */}
      {!notif.read && (
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--tec-gold)', flexShrink: 0, marginTop: 6 }} />
      )}
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{ padding: 'var(--sp-12)', textAlign: 'center', color: 'var(--tec-text-3)' }}>
      <div style={{ fontSize: 40, marginBottom: 'var(--sp-3)' }}>🔔</div>
      <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 6 }}>All caught up</div>
      <div style={{ fontSize: 'var(--text-sm)' }}>No notifications yet</div>
    </div>
  );
}

// ── Section ────────────────────────────────────────────────────
function NotifSection({ title, count, notifications, onRead }: {
  title: string; count: number;
  notifications: Notification[]; onRead: (id: string) => void;
}) {
  if (!notifications.length) return null;
  return (
    <div style={{ marginBottom: 'var(--sp-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 'var(--sp-3) var(--sp-5)', borderBottom: '1px solid var(--tec-border)' }}>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--tec-text-3)', letterSpacing: 2, textTransform: 'uppercase' }}>{title}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tec-gold)', background: 'var(--tec-gold-glow)', border: '1px solid var(--tec-border-gold)', padding: '1px 7px', borderRadius: 'var(--radius-full)' }}>
          {count}
        </span>
      </div>
      {notifications.map(n => <NotifCard key={n.id} notif={n} onRead={onRead} />)}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────
export default function NotificationsPage() {
  const {
    notifications, unreadCount,
    isLoading, isRefreshing, error,
    refetch, markAsRead, markAllAsRead,
  } = useNotifications();

  const unread = notifications.filter(n => !n.read);
  const read   = notifications.filter(n =>  n.read);

  return (
    <DashboardShell
      title="Notifications"
      subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
      badge={unreadCount > 0 ? { text: `${unreadCount}`, color: 'gold' } : undefined}
      loading={isLoading}
      actions={
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead}
              style={{ padding: '7px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--tec-gold-dim)', border: '1px solid var(--tec-border-gold)', color: 'var(--tec-gold)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer' }}>
              ✓ Mark all read
            </button>
          )}
          <button onClick={refetch} disabled={isRefreshing}
            style={{ padding: '7px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--tec-surface-2)', border: '1px solid var(--tec-border)', color: 'var(--tec-text-2)', fontSize: 'var(--text-sm)', cursor: 'pointer', opacity: isRefreshing ? 0.6 : 1 }}>
            {isRefreshing ? '⟳' : '↻'} Refresh
          </button>
        </div>
      }
    >
      {error && (
        <div style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>⚠️</span>
          <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: '#ef4444' }}>{error}</span>
          <button onClick={refetch}
            style={{ padding: '5px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}

      <DashboardCard padding="0">
        {notifications.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <NotifSection
              title="Unread" count={unread.length}
              notifications={unread} onRead={markAsRead}
            />
            <NotifSection
              title="Earlier" count={read.length}
              notifications={read} onRead={markAsRead}
            />
          </>
        )}
      </DashboardCard>
    </DashboardShell>
  );
}
