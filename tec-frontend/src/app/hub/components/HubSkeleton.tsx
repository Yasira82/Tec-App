'use client';

export function HubSkeleton() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--tec-bg)', padding: '0 0 90px' }}>
      <style>{`@keyframes shimmer{0%,100%{opacity:0.4}50%{opacity:0.8}}.sk{animation:shimmer 1.4s ease infinite;background:var(--tec-surface-1);border-radius:18px}`}</style>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #ffffff08', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: '#FBBF2430' }} />
          <div style={{ width: 60, height: 20, borderRadius: 6, background: '#ffffff08' }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ffffff08' }} />
          <div style={{ width: 90, height: 36, borderRadius: 12, background: '#ffffff08' }} />
        </div>
      </div>
      <div style={{ padding: '16px 16px 0' }}><div className="sk" style={{ height: 120 }} /></div>
      <div style={{ padding: '10px 16px 0' }}><div className="sk" style={{ height: 80 }} /></div>
      <div style={{ padding: '12px 16px 0' }}><div className="sk" style={{ height: 100 }} /></div>
      <div style={{ padding: '10px 16px 0', display: 'flex', gap: 10 }}>
        <div className="sk" style={{ flex: 1, height: 54 }} />
        <div className="sk" style={{ flex: 1, height: 54 }} />
      </div>
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          {[1,2,3,4].map(i => <div key={i} className="sk" style={{ height: 68 }} />)}
        </div>
      </div>
    </div>
  );
}
