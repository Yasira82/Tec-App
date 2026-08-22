'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAccessToken }                   from '@/lib-client/pi/pi-auth';
import { useTranslation, bcp47 }            from '@/lib/i18n';
import { HubSubShell }                      from '@/components/hub';
import { DashboardCard }                    from '@/components/dashboard';
import { sessionToken } from '@/lib-client/pi/session-source';

/* ─── Types ─────────────────────────────────────────────────── */
interface Overview {
  totalEvents?:   number;
  totalPayments?: number;
  totalUsers?:    number;
  recentMetrics?: { date: string; paymentCount: number; userCount: number }[];
}

interface Metrics24h {
  total:       number;
  completed:   number;
  failed:      number;
  cancelled:   number;
  volume:      number;
  successRate: number | null;
  healthy:     boolean;
}

interface AnalyticsEvent {
  id:        string;
  type:      string;
  createdAt: string;
  userId?:   string;
}

/* ─── Stat tile ─────────────────────────────────────────────── */
function StatTile({
  label, value, sub, accent,
}: {
  label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div style={{
      padding: 'var(--sp-5)',
      background: 'var(--tec-surface-2)',
      border: '1px solid var(--tec-border)',
      borderRadius: 'var(--radius-xl)',
    }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: accent ?? 'var(--tec-text-1)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', marginTop: 6 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/* ─── Event row ─────────────────────────────────────────────── */
const EVENT_ICONS: Record<string, string> = {
  'payment.completed': '✅',
  'payment.failed':    '❌',
  'payment.cancelled': '⚠️',
  'auth.login':        '🔑',
  'user.created':      '👤',
  'kyc.submitted':     '📋',
  'kyc.verified':      '✔️',
};

function EventRow({ event }: { event: AnalyticsEvent }) {
  const { locale } = useTranslation();
  const icon  = EVENT_ICONS[event.type] ?? '📡';
  // The event NAME stays as emitted (`payment.completed.v1`) — it is a C-70 contract
  // identifier, not prose, and translating it would break the link to the catalog.
  // Only the clock around it follows the reader's locale.
  const label = event.type.replace(/\./g, ' › ');
  const ts    = new Date(event.createdAt).toLocaleTimeString(bcp47(locale), { hour: '2-digit', minute: '2-digit' });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-5)', borderBottom: '1px solid var(--tec-border)' }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-1)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </div>
        {event.userId && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {event.userId}
          </div>
        )}
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', flexShrink: 0 }}>{ts}</div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */
export default function HubAnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [metrics,  setMetrics]  = useState<Metrics24h | null>(null);
  const [events,   setEvents]   = useState<AnalyticsEvent[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);
  const { t } = useTranslation();
  const a     = t.hub.analytics;

  const load = useCallback(async () => {
    const token   = sessionToken();
    const headers: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};

    setLoading(true);
    setError(false);
    try {
      const [ovRes, mxRes, evRes] = await Promise.all([
        fetch('/api/analytics?endpoint=overview', { headers, credentials: 'include', cache: 'no-store' }),
        fetch('/api/bff/metrics',                 { credentials: 'include', cache: 'no-store' }),
        fetch('/api/analytics?endpoint=events&limit=12', { headers, credentials: 'include', cache: 'no-store' }),
      ]);
      if (ovRes.ok) setOverview(await ovRes.json());
      if (mxRes.ok) setMetrics(await mxRes.json());
      if (evRes.ok) {
        const d = await evRes.json();
        setEvents(d?.events ?? d?.data ?? []);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const successColor = (r: number | null) =>
    r === null ? 'var(--tec-text-3)' : r >= 80 ? '#22C55E' : r >= 60 ? '#f0c040' : '#ef4444';

  return (
    <HubSubShell title={a.title} subtitle={a.subtitle}>

      {/* ── Refresh button ──────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--sp-4)' }}>
        <button
          onClick={load}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 16px', borderRadius: 'var(--radius-sm)',
            background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border)',
            color: 'var(--tec-text-2)', fontSize: 'var(--text-xs)',
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
          }}
        >
          <span style={{ display: 'inline-block', animation: loading ? 'tec-spin 0.8s linear infinite' : 'none' }}>↻</span>
          {a.refresh}
        </button>
      </div>

      {error && (
        <div style={{ padding: 'var(--sp-5)', borderRadius: 'var(--radius-xl)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 'var(--text-sm)', marginBottom: 'var(--sp-5)', textAlign: 'center' }}>
          {a.loadFailed}
        </div>
      )}

      {/* ── 24h Payments ────────────────────────────────── */}
      <DashboardCard title={a.payments24h} glass>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--sp-3)', padding: 'var(--sp-5)' }}>
          <StatTile label={a.completed} value={loading ? '…' : (metrics?.completed ?? '—')} accent="#22C55E" />
          <StatTile label={a.failed}    value={loading ? '…' : (metrics?.failed ?? '—')}    accent="#ef4444" />
          <StatTile label={a.cancelled} value={loading ? '…' : (metrics?.cancelled ?? '—')} accent="#f0c040" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)', padding: '0 var(--sp-5) var(--sp-5)' }}>
          <StatTile
            label={a.volume}
            value={loading ? '…' : metrics ? `${metrics.volume.toFixed(4)} π` : '—'}
            accent="#FBBF24"
          />
          <StatTile
            label={a.successRate}
            value={loading ? '…' : metrics?.successRate != null ? `${metrics.successRate}%` : a.na}
            sub={metrics ? (metrics.healthy ? `✓ ${a.healthy}` : `⚠ ${a.degraded}`) : undefined}
            accent={metrics ? successColor(metrics.successRate ?? null) : undefined}
          />
        </div>
      </DashboardCard>

      {/* ── Platform Totals ──────────────────────────────── */}
      <DashboardCard title={a.totals} glass>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--sp-3)', padding: 'var(--sp-5)' }}>
          <StatTile label={a.totalPayments} value={loading ? '…' : (overview?.totalPayments ?? '—')} />
          <StatTile label={a.totalUsers}    value={loading ? '…' : (overview?.totalUsers    ?? '—')} />
          <StatTile label={a.totalEvents}   value={loading ? '…' : (overview?.totalEvents   ?? '—')} />
        </div>
      </DashboardCard>

      {/* ── Recent Events ───────────────────────────────── */}
      <DashboardCard
        title={a.recentEvents}
        action={
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', fontFamily: 'var(--font-mono)' }}>
            {a.live}
          </span>
        }
        glass
      >
        {loading ? (
          <div style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--tec-text-3)', fontSize: 'var(--text-sm)' }}>
            {a.loading}
          </div>
        ) : events.length === 0 ? (
          <div style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--tec-text-3)', fontSize: 'var(--text-sm)' }}>
            {a.noEvents}
          </div>
        ) : (
          <div>
            {events.map(e => <EventRow key={e.id} event={e} />)}
          </div>
        )}
      </DashboardCard>

      <style>{`@keyframes tec-spin{to{transform:rotate(360deg)}}`}</style>
    </HubSubShell>
  );
}
