'use client';

export function PullIndicator({ progress, refreshing }: { progress: number; refreshing: boolean }) {
  if (progress === 0 && !refreshing) return null;
  return (
    <div style={{ position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)', zIndex: 200 }}>
      <div style={{ background: '#0B1020', border: '1px solid #FBBF2430', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {refreshing
          ? <div style={{ width: 16, height: 16, border: '2px solid #FBBF2430', borderTop: '2px solid #FBBF24', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
          : <span style={{ fontSize: 14, transform: `rotate(${progress * 180}deg)`, display: 'inline-block', transition: 'transform 0.1s' }}>↓</span>}
      </div>
    </div>
  );
}
