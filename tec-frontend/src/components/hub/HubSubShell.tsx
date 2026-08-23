'use client';

import { ReactNode }      from 'react';
import { useRouter }      from 'next/navigation';
import { useTranslation } from '@/lib/i18n';

interface Props {
  title:     string;
  subtitle?: string;
  badge?:    { text: string; color?: 'gold' | 'green' | 'red' | 'blue' };
  actions?:  ReactNode;
  loading?:  boolean;
  children:  ReactNode;
}

const BADGE_COLORS = {
  gold:  { bg: 'rgba(248,184,32,0.1)',  border: 'rgba(248,184,32,0.25)',  color: 'var(--tec-gold)' },
  green: { bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.25)',  color: 'var(--tec-green)' },
  red:   { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)',   color: 'var(--tec-red)' },
  blue:  { bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.25)',  color: 'var(--tec-blue)' },
};

function Skeleton() {
  return (
    <div style={{ padding: '24px 20px' }}>
      <div className="tec-skeleton" style={{ width: 160, height: 28, marginBottom: 8, borderRadius: 8 }} />
      <div className="tec-skeleton" style={{ width: 240, height: 16, marginBottom: 32, borderRadius: 6 }} />
      {[1, 2, 3].map(i => (
        <div key={i} className="tec-skeleton" style={{ height: 80, borderRadius: 12, marginBottom: 12 }} />
      ))}
    </div>
  );
}

export function HubSubShell({ title, subtitle, badge, actions, loading, children }: Props) {
  const router     = useRouter();
  const { dir }    = useTranslation();
  const badgeStyle = badge ? BADGE_COLORS[badge.color ?? 'gold'] : null;

  // Direction lives HERE, not on each page: every Hub sub-page renders through this
  // shell, so one `dir` covers all of them and none can be forgotten. The back arrow
  // points the way "back" actually is — in RTL that is to the right.
  return (
    <div dir={dir} style={{ minHeight: '100vh', background: 'var(--tec-bg)', color: 'var(--tec-text-1)', fontFamily: 'var(--font-sans)', paddingBottom: 32, position: 'relative' }}>

      {/* Branded band behind the header. Inner pages used to open on exactly the
          same flat ground as the Hub, so tapping through felt like nothing had
          happened. A wash of the brand colour at the top says "you went
          somewhere" — and it fades out rather than ending in a hard edge, so it
          reads as light on the page instead of a second bar. */}
      <div aria-hidden style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 180,
        background: 'var(--tec-band)', pointerEvents: 'none',
      }} />

      {/* ── Sticky header ──────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12,
        background: 'transparent', backdropFilter: 'blur(20px)',
        borderBottom: 'none',
        // Sticky chrome must not swallow a scroll that starts on it.
        touchAction: 'pan-y',
      }}>
        <button
          onClick={() => router.push('/hub')}
          style={{
            background: 'var(--tec-surface-2)', border: '1px solid var(--tec-border)',
            borderRadius: 10, padding: '7px 12px', color: 'var(--tec-text-2)',
            fontSize: 14, cursor: 'pointer', flexShrink: 0,
          }}>
          {dir === 'rtl' ? '→' : '←'}
        </button>
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--tec-text-1)' }}>{title}</span>
            {badge && badgeStyle && (
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1,
                padding: '2px 8px', borderRadius: 999,
                background: badgeStyle.bg, border: `1px solid ${badgeStyle.border}`,
                color: badgeStyle.color,
              }}>
                {badge.text}
              </span>
            )}
          </div>
          {subtitle && (
            <div style={{ fontSize: 11, color: 'var(--tec-text-3)', marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{actions}</div>
        )}
      </header>

      {/* ── Content ────────────────────────────── */}
      {loading ? (
        <Skeleton />
      ) : (
        <div className="tec-fade-in" style={{ maxWidth: 720, margin: '0 auto', padding: '20px 20px 0' }}>
          {children}
        </div>
      )}
    </div>
  );
}
