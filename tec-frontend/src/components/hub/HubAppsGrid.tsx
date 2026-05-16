'use client';

import { useRouter } from 'next/navigation';
import { haptic }    from '@/lib/hub/utils';
import { HubApp }    from '@/lib/hub/types';

interface Props {
  apps: HubApp[];
}

export function HubAppsGrid({ apps }: Props) {
  const router = useRouter();

  if (!apps.length) return null;

  return (
    <div style={{ padding: '24px 16px 0', animation: 'tec-fade-in 0.6s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="tec-pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: 2, textTransform: 'uppercase' }}>Live Now</span>
        </div>
        <span style={{ fontSize: 10, color: '#10b981', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: '3px 10px', borderRadius: 999, letterSpacing: 1 }}>
          {apps.length} ACTIVE
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
        {apps.map((app, idx) => (
          <button key={app.slug} className="tec-app-card"
            onClick={() => { haptic('light'); router.push(app.href); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', background: '#0d0d18',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 18, cursor: 'pointer', textAlign: 'left',
              animation: `tec-fade-in ${0.3 + idx * 0.05}s ease both`,
            }}>
            <div style={{
              width: 42, height: 42, borderRadius: 14,
              background: 'rgba(212,175,55,0.08)',
              border: '1px solid rgba(212,175,55,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, minWidth: 42,
            }}>
              {app.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {app.name}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>{app.desc}</div>
            </div>
            <span className="tec-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', minWidth: 6 }} />
          </button>
        ))}
      </div>
    </div>
  );
}
