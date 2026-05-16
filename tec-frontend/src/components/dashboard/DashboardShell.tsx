'use client';

import { ReactNode } from 'react';

interface Props {
  title?:    string;
  subtitle?: string;
  badge?:    { text: string; color?: 'gold' | 'green' | 'red' | 'blue' };
  actions?:  ReactNode;
  loading?:  boolean;
  children:  ReactNode;
}

function Skeleton() {
  return (
    <div style={{ padding: 'var(--sp-6)' }}>
      <div className="tec-skeleton" style={{ width: 160, height: 28, marginBottom: 8 }} />
      <div className="tec-skeleton" style={{ width: 240, height: 16, marginBottom: 32 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 24 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="tec-skeleton" style={{ height: 80, borderRadius: 'var(--radius-lg)' }} />
        ))}
      </div>
      <div className="tec-skeleton" style={{ height: 200, borderRadius: 'var(--radius-lg)' }} />
    </div>
  );
}

const BADGE_COLORS = {
  gold:  { bg: 'rgba(212,175,55,0.1)',  border: 'rgba(212,175,55,0.25)',  color: '#d4af37' },
  green: { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)',  color: '#10b981' },
  red:   { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)',   color: '#ef4444' },
  blue:  { bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.25)',  color: '#3b82f6' },
};

export function DashboardShell({ title, subtitle, badge, actions, loading, children }: Props) {
  if (loading) return <Skeleton />;

  const badgeStyle = badge ? BADGE_COLORS[badge.color ?? 'gold'] : null;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* ── Page header ──────────────────────────── */}
      {(title || actions) && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          marginBottom: 'var(--sp-6)', gap: 'var(--sp-4)', flexWrap: 'wrap',
        }}>
          <div>
            {title && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: subtitle ? 4 : 0 }}>
                <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--tec-text-1)', margin: 0 }}>
                  {title}
                </h1>
                {badge && badgeStyle && (
                  <span style={{
                    fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: 1,
                    padding: '3px 10px', borderRadius: 'var(--radius-full)',
                    background: badgeStyle.bg, border: `1px solid ${badgeStyle.border}`,
                    color: badgeStyle.color,
                  }}>
                    {badge.text}
                  </span>
                )}
              </div>
            )}
            {subtitle && (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', margin: 0, letterSpacing: 0.3 }}>
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexShrink: 0 }}>
              {actions}
            </div>
          )}
        </div>
      )}

      {/* ── Content ──────────────────────────────── */}
      <div className="tec-fade-in">
        {children}
      </div>
    </div>
  );
}
