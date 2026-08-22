'use client';

import { useNotifications, Notification, NotifType } from '@/lib-client/hooks/useNotifications';
import { useTranslation, fill, bcp47, errorText, type Translations } from '@/lib/i18n';
import { HubSubShell }                               from '@/components/hub';
import { DashboardCard }                             from '@/components/dashboard';

/** Relative time, in the reader's language. Beyond a week it falls back to a real
 *  date — formatted by the locale, so Arabic gets Arabic month names rather than
 *  "Aug" sitting inside an Arabic sentence. */
function formatDate(iso: string, t: Translations, locale: 'en' | 'ar') {
  const n    = t.hub.notifications;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins <  1) return n.justNow;
  if (mins < 60) return fill(n.minsAgo, { n: mins });
  if (hrs  < 24) return fill(n.hrsAgo,  { n: hrs  });
  if (days <  7) return fill(n.daysAgo, { n: days });
  return new Date(iso).toLocaleDateString(bcp47(locale), { month: 'short', day: 'numeric' });
}

const TYPE_CONFIG: Record<NotifType, { icon: string; color: string; bg: string }> = {
  PAYMENT:  { icon: '💳', color: 'var(--tec-blue)', bg: 'rgba(59,130,246,0.1)'  },
  WALLET:   { icon: '💰', color: 'var(--tec-gold)', bg: 'rgba(251,191,36,0.1)'  },
  KYC:      { icon: '🪪', color: 'var(--tec-purple)', bg: 'rgba(139,92,246,0.1)'  },
  SECURITY: { icon: '🔒', color: 'var(--tec-red)', bg: 'rgba(239,68,68,0.1)'   },
  SYSTEM:   { icon: '⚙️', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
};

function NotifCard({ notif, onRead }: { notif: Notification; onRead: (id: string) => void }) {
  const { t, locale } = useTranslation();
  const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.SYSTEM;
  return (
    <div
      onClick={() => !notif.read && onRead(notif.id)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)',
        padding: 'var(--sp-4) var(--sp-5)',
        borderBottom: '1px solid var(--tec-border)',
        background: notif.read ? 'transparent' : 'rgba(251,191,36,0.03)',
        cursor: notif.read ? 'default' : 'pointer',
        transition: 'background 0.15s ease',
      }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
        {cfg.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: notif.read ? 400 : 600, color: 'var(--tec-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {notif.title}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {formatDate(notif.created_at, t, locale)}
          </div>
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', lineHeight: 1.5 }}>
          {notif.message}
        </div>
        <div style={{ marginTop: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: cfg.color, background: cfg.bg, padding: '2px 8px', borderRadius: 'var(--radius-full)', textTransform: 'uppercase' }}>
            {notif.type}
          </span>
        </div>
      </div>
      {!notif.read && (
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--tec-gold)', flexShrink: 0, marginTop: 6 }} />
      )}
    </div>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <div style={{ padding: 'var(--sp-12)', textAlign: 'center', color: 'var(--tec-text-3)' }}>
      <div style={{ fontSize: 40, marginBottom: 'var(--sp-3)' }}>🔔</div>
      <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 6 }}>{t.hub.notifications.allCaught}</div>
      <div style={{ fontSize: 'var(--text-sm)' }}>{t.hub.notifications.empty}</div>
    </div>
  );
}

function NotifSection({ title, count, notifications, onRead }: {
  title: string; count: number; notifications: Notification[]; onRead: (id: string) => void;
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

export default function HubNotificationsPage() {
  const { notifications, unreadCount, isLoading, isRefreshing, error, refetch, markAsRead, markAllAsRead } = useNotifications();
  const { t } = useTranslation();
  const n     = t.hub.notifications;

  const unread = notifications.filter(x => !x.read);
  const read   = notifications.filter(x =>  x.read);

  return (
    <HubSubShell
      title={n.title}
      subtitle={unreadCount > 0 ? fill(n.unreadCount, { n: unreadCount }) : n.allCaught}
      badge={unreadCount > 0 ? { text: `${unreadCount}`, color: 'gold' } : undefined}
      loading={isLoading}
      actions={
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead}
              style={{ padding: '7px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--tec-gold-dim)', border: '1px solid var(--tec-border-gold)', color: 'var(--tec-gold)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer' }}>
              ✓ {n.markAllRead}
            </button>
          )}
          <button onClick={refetch} disabled={isRefreshing}
            style={{ padding: '7px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--tec-border)', color: 'var(--tec-text-2)', fontSize: 'var(--text-sm)', cursor: 'pointer', opacity: isRefreshing ? 0.6 : 1 }}>
            {isRefreshing ? '⟳' : '↻'}
          </button>
        </div>
      }
    >
      {error && (
        <div style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>⚠️</span>
          <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--tec-red)' }}>{errorText(t, error)}</span>
          <button onClick={refetch}
            style={{ padding: '5px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--tec-red)', fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
            {n.retry}
          </button>
        </div>
      )}

      <DashboardCard padding="0">
        {notifications.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <NotifSection title={n.unread}  count={unread.length} notifications={unread} onRead={markAsRead} />
            <NotifSection title={n.earlier} count={read.length}   notifications={read}   onRead={markAsRead} />
          </>
        )}
      </DashboardCard>
    </HubSubShell>
  );
}
