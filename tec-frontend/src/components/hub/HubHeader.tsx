'use client';

import { useRouter } from 'next/navigation';
import { haptic }    from '@/lib/hub/utils';

interface Props {
  piUsername:  string;
  time:        string;
  notifCount:  number;
  onNotifClick: () => void;
}

export function HubHeader({ piUsername, time, notifCount, onNotifClick }: Props) {
  const router = useRouter();

  return (
    <header style={{
      padding: '14px 20px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(5,8,22,0.85)',
      backdropFilter: 'blur(24px) saturate(1.8)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: 'linear-gradient(135deg,#FBBF24,#F59E0B)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 13, color: '#0a0800',
          boxShadow: '0 2px 12px rgba(251,191,36,0.3)',
        }}>T</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#FBBF24', letterSpacing: 1.5, lineHeight: 1 }}>TEC</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', letterSpacing: 2, lineHeight: 1.4 }}>ECOSYSTEM</div>
        </div>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontVariantNumeric: 'tabular-nums' }}>{time}</span>

        {/* Notifications */}
        <button className="tec-btn" onClick={onNotifClick}
          aria-label={`Notifications${notifCount > 0 ? ` — ${notifCount} unread` : ''}`}
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: notifCount > 0 ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${notifCount > 0 ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.08)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 16, position: 'relative',
          }}>
          🔔
          {notifCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              minWidth: 17, height: 17, borderRadius: 999,
              background: '#ef4444', border: '2px solid #050816',
              fontSize: 9, fontWeight: 800, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 3px',
            }}>
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </button>

        {/* Avatar */}
        <button className="tec-btn" onClick={() => { haptic('light'); router.push('/dashboard'); }}
          aria-label="Open dashboard"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(251,191,36,0.08)',
            border: '1px solid rgba(251,191,36,0.2)',
            borderRadius: 12, padding: '5px 10px 5px 5px', cursor: 'pointer',
          }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            background: 'linear-gradient(135deg,#FBBF24,#F59E0B)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: '#0a0800',
          }}>
            {piUsername[0]?.toUpperCase()}
          </div>
          <span style={{ fontSize: 12, color: '#FBBF24', fontWeight: 600 }}>@{piUsername}</span>
        </button>
      </div>
    </header>
  );
}
