'use client';

import { ReactNode } from 'react';

interface Props {
  title?:    string;
  subtitle?: string;
  action?:   ReactNode;
  children:  ReactNode;
  glass?:    boolean;
  padding?:  string;
}

export function DashboardCard({ title, subtitle, action, children, glass, padding }: Props) {
  return (
    <div style={{
      background:   glass ? 'rgba(255,255,255,0.02)' : 'var(--tec-surface-2)',
      border:       '1px solid var(--tec-border)',
      borderRadius: 'var(--radius-xl)',
      overflow:     'hidden',
    }}>
      {(title || action) && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--sp-4) var(--sp-5)', borderBottom: '1px solid var(--tec-border)',
        }}>
          <div>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--tec-text-1)' }}>
              {title}
            </div>
            {subtitle && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', marginTop: 2 }}>
                {subtitle}
              </div>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div style={{ padding: padding ?? 'var(--sp-5)' }}>
        {children}
      </div>
    </div>
  );
}
