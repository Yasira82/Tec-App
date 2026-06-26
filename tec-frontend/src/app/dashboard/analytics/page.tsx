'use client';

import { useEffect, useState, useCallback } from 'react';
import { getAccessToken } from '@/lib-client/pi/pi-auth';

interface Overview {
  totalEvents:   number;
  totalPayments: number;
  totalUsers:    number;
  recentMetrics: DailyMetric[];
}

interface DailyMetric {
  date:           string;
  total_payments: number;
  total_volume:   number;
  new_users:      number;
}

const s = (style: React.CSSProperties) => style;

function StatCard({ icon, label, value, color = '#FBBF24' }: {
  icon: string; label: string; value: string | number; color?: string;
}) {
  return (
    <div style={s({ background: '#0B1020', border: `1px solid ${color}20`, borderRadius: 18, padding: '16px 20px' })}>
      <div style={s({ fontSize: 24, marginBottom: 8 })}>{icon}</div>
      <div style={s({ fontSize: 24, fontWeight: 900, color, lineHeight: 1 })}>{value}</div>
      <div style={s({ fontSize: 11, color: '#4a4a5a', marginTop: 4, letterSpacing: 1 })}>{label}</div>
    </div>
  );
}

function MetricBar({ label, value, max, color }: {
  label: string; value: number; max: number; color: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={s({ marginBottom: 12 })}>
      <div style={s({ display: 'flex', justifyContent: 'space-between', marginBottom: 4 })}>
        <span style={s({ fontSize: 12, color: '#6b6b7a' })}>{label}</span>
        <span style={s({ fontSize: 12, fontWeight: 700, color })}>{value}</span>
      </div>
      <div style={s({ height: 4, background: '#ffffff08', borderRadius: 4, overflow: 'hidden' })}>
        <div style={s({ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.5s ease' })} />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [overview,     setOverview]     = useState<Overview | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const fetchOverview = useCallback(async (silent = false) => {
    // ✅ VM-004: cookie بدل localStorage
    const token = getAccessToken();
    if (silent) setIsRefreshing(true);
    else        setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics?endpoint=overview', {
        credentials: 'include',
        headers:     token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const d = await res.json();
      setOverview(d.data ?? d);
    } catch (e) {
      setError(`Failed to load analytics: ${e}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  if (isLoading) {
    return (
      <div style={s({ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' })}>
        <div style={s({ width: 36, height: 36, border: '2px solid #FBBF2430', borderTop: '2px solid #FBBF24', borderRadius: '50%', animation: 'spin 0.8s linear infinite' })} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const metrics  = overview?.recentMetrics ?? [];
  const maxPay   = Math.max(...metrics.map(m => m.total_payments), 1);
  const maxVol   = Math.max(...metrics.map(m => m.total_volume),   1);
  const maxUsers = Math.max(...metrics.map(m => m.new_users),      1);
  const totalVol = metrics.reduce((s, m) => s + m.total_volume, 0);

  return (
    <div style={s({ padding: '24px 16px', maxWidth: 600, margin: '0 auto' })}>

      {/* Header */}
      <div style={s({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 })}>
        <div>
          <h1 style={s({ fontSize: 28, fontWeight: 800, color: '#fff', margin: 0 })}>Analytics</h1>
          <p style={s({ fontSize: 13, color: '#6b6b7a', marginTop: 4 })}>TEC Platform Metrics</p>
        </div>
        <button
          onClick={() => fetchOverview(true)}
          disabled={isRefreshing}
          style={s({ background: '#FBBF2415', border: '1px solid #FBBF2430', borderRadius: 10, padding: '8px 14px', color: '#FBBF24', fontSize: 12, fontWeight: 600, cursor: 'pointer' })}
        >
          {isRefreshing ? '⟳ ...' : '⟳ Refresh'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={s({ padding: '12px 16px', borderRadius: 12, background: '#1f0505', border: '1px solid #e74c3c30', color: '#e74c3c', fontSize: 13, marginBottom: 16 })}>
          ⚠️ {error}
        </div>
      )}

      {/* Stats Grid */}
      <div style={s({ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 })}>
        <StatCard icon="💳" label="TOTAL PAYMENTS"   value={overview?.totalPayments ?? 0} color="#7ee7c0" />
        <StatCard icon="👥" label="TOTAL USERS"      value={overview?.totalUsers    ?? 0} color="#7eb8f7" />
        <StatCard icon="📊" label="TOTAL EVENTS"     value={overview?.totalEvents   ?? 0} color="#FBBF24" />
        <StatCard icon="💰" label="TOTAL VOLUME (π)" value={totalVol.toFixed(2)}          color="#e67e22" />
      </div>

      {/* 7-Day Metrics */}
      {metrics.length > 0 && (
        <div style={s({ background: '#0B1020', border: '1px solid #ffffff08', borderRadius: 18, padding: '20px', marginBottom: 16 })}>
          <div style={s({ fontSize: 11, color: '#4a4a5a', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 })}>
            Last {metrics.length} Days
          </div>
          {metrics.map((m, i) => (
            <div key={i} style={s({ marginBottom: 20, paddingBottom: 20, borderBottom: i < metrics.length - 1 ? '1px solid #ffffff06' : 'none' })}>
              <div style={s({ fontSize: 12, color: '#6b6b7a', marginBottom: 8 })}>
                {new Date(m.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <MetricBar label="Payments"  value={m.total_payments} max={maxPay}   color="#7ee7c0" />
              <MetricBar label="Volume π"  value={m.total_volume}   max={maxVol}   color="#FBBF24" />
              <MetricBar label="New Users" value={m.new_users}      max={maxUsers} color="#7eb8f7" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {metrics.length === 0 && !error && (
        <div style={s({ textAlign: 'center', padding: '48px 20px', background: '#0B1020', border: '1px solid #ffffff08', borderRadius: 18 })}>
          <div style={s({ fontSize: 48, marginBottom: 16 })}>📊</div>
          <p style={s({ fontSize: 16, fontWeight: 600, color: '#6b6b7a' })}>No data yet</p>
          <p style={s({ fontSize: 13, color: '#4a4a5a', marginTop: 4 })}>Analytics will appear after platform activity</p>
        </div>
      )}

    </div>
  );
}
