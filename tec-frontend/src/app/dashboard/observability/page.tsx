'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardCard }  from '@/components/dashboard/DashboardCard';

interface Metrics {
  window:      '24h';
  total:       number;
  completed:   number;
  failed:      number;
  cancelled:   number;
  pending:     number;
  successRate: number | null;
  volume:      number;
  healthy:     boolean;
  generatedAt: string;
}

const POLL_MS = 30_000;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function StatCard({
  label, value, color, sub,
}: {
  label: string;
  value: string | number;
  color: string;
  sub?:  string;
}) {
  return (
    <div style={{
      background:   'var(--tec-surface-2)',
      border:       '1px solid var(--tec-border)',
      borderRadius: 'var(--radius-xl)',
      padding:      'var(--sp-5)',
    }}>
      <div style={{
        fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)',
        fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color, lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function BarRow({
  label, value, total, color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
      <div style={{ width: 80, fontSize: 'var(--text-sm)', color: 'var(--tec-text-2)', flexShrink: 0 }}>
        {label}
      </div>
      <div style={{
        flex: 1, height: 8, background: 'rgba(255,255,255,0.06)',
        borderRadius: 4, overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color,
          borderRadius: 4, transition: 'width 0.5s ease',
        }} />
      </div>
      <div style={{
        width: 36, textAlign: 'right', fontSize: 'var(--text-sm)',
        fontWeight: 700, color, flexShrink: 0,
      }}>
        {value}
      </div>
      <div style={{
        width: 40, textAlign: 'right', fontSize: 'var(--text-xs)',
        color: 'var(--tec-text-3)', flexShrink: 0,
      }}>
        {pct}%
      </div>
    </div>
  );
}

export default function ObservabilityPage() {
  const [metrics,    setMetrics]    = useState<Metrics | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/bff/metrics', { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const raw = await res.json();
      // The BFF serializes `volume` as a string (toFixed) — coerce every numeric
      // field so a string never reaches `.toFixed()` in render (that threw and
      // crashed the page into the error boundary). Fail-safe on missing fields.
      const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
      setMetrics({
        window:      '24h',
        total:       num(raw?.total),
        completed:   num(raw?.completed),
        failed:      num(raw?.failed),
        cancelled:   num(raw?.cancelled),
        pending:     num(raw?.pending),
        successRate: raw?.successRate === null || raw?.successRate === undefined ? null : num(raw.successRate),
        volume:      num(raw?.volume),
        healthy:     !!raw?.healthy,
        generatedAt: typeof raw?.generatedAt === 'string' ? raw.generatedAt : new Date().toISOString(),
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(() => load(true), POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  const healthBadge = metrics
    ? metrics.healthy
      ? { text: 'HEALTHY',  color: 'green' as const }
      : { text: 'DEGRADED', color: 'red'   as const }
    : undefined;

  return (
    <DashboardShell
      title="Payment Observability"
      subtitle="24-hour payment health · auto-refreshes every 30s"
      badge={healthBadge}
      loading={loading}
      actions={
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          style={{
            background: 'transparent',
            border: '1px solid rgba(248,184,32,0.25)',
            borderRadius: 'var(--radius-md)',
            color: refreshing ? 'var(--tec-text-3)' : 'var(--tec-gold)',
            padding: '7px 14px', fontSize: 'var(--text-sm)',
            cursor: refreshing ? 'not-allowed' : 'pointer',
          }}
        >
          {refreshing ? '⟳ Refreshing…' : '↻ Refresh'}
        </button>
      }
    >
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4)',
          color: '#ef4444', fontSize: 'var(--text-sm)', marginBottom: 'var(--sp-5)',
        }}>
          ⚠ {error}
        </div>
      )}

      {metrics && (
        <>
          {/* ── Stat Cards ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12, marginBottom: 'var(--sp-5)',
          }}>
            <StatCard label="Total Tx"  value={metrics.total}                   color="var(--tec-text-1)" sub="last 24h" />
            <StatCard label="Completed" value={metrics.completed}               color="#22C55E"           sub="successful" />
            <StatCard label="Failed"    value={metrics.failed}                  color="#ef4444"           sub="errored" />
            <StatCard label="Volume"    value={`${metrics.volume.toFixed(2)}π`} color="#F8B820"           sub="completed value" />
          </div>

          {/* ── Success Rate ── */}
          <DashboardCard
            title="Success Rate"
            subtitle="completed / total (24h)"
            action={
              <span style={{
                fontSize: 'var(--text-2xl)', fontWeight: 800,
                color: metrics.healthy ? '#22C55E' : '#ef4444',
              }}>
                {metrics.successRate === null ? '—' : `${metrics.successRate}%`}
              </span>
            }
          >
            <div style={{
              height: 12, background: 'rgba(255,255,255,0.06)',
              borderRadius: 6, overflow: 'hidden', marginBottom: 8,
            }}>
              <div style={{
                width: `${metrics.successRate ?? 0}%`,
                height: '100%',
                background: metrics.healthy
                  ? 'linear-gradient(90deg,#22C55E,#34d399)'
                  : 'linear-gradient(90deg,#ef4444,#f87171)',
                borderRadius: 6,
                transition: 'width 0.7s ease',
              }} />
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>
              {metrics.total === 0
                ? 'No transactions in this window'
                : `${metrics.completed} of ${metrics.total} transactions completed`}
            </div>
          </DashboardCard>

          {/* ── Breakdown ── */}
          <div style={{ marginTop: 'var(--sp-4)' }}>
            <DashboardCard title="Breakdown" subtitle="transaction status distribution">
              <BarRow label="Completed" value={metrics.completed} total={metrics.total} color="#22C55E" />
              <BarRow label="Cancelled" value={metrics.cancelled} total={metrics.total} color="#d88810" />
              <BarRow label="Failed"    value={metrics.failed}    total={metrics.total} color="#ef4444" />
              <BarRow label="Pending"   value={metrics.pending}   total={metrics.total} color="#6366f1" />
            </DashboardCard>
          </div>

          {/* ── Footer ── */}
          <div style={{
            marginTop: 'var(--sp-4)', fontSize: 'var(--text-xs)',
            color: 'var(--tec-text-3)', textAlign: 'right',
          }}>
            Generated at {formatTime(metrics.generatedAt)}
          </div>
        </>
      )}

      {!metrics && !loading && !error && (
        <div style={{ textAlign: 'center', color: 'var(--tec-text-3)', padding: 'var(--sp-10)' }}>
          No data available
        </div>
      )}
    </DashboardShell>
  );
}
