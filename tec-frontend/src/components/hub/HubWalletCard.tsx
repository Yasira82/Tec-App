'use client';

import { useRouter } from 'next/navigation';
import { haptic }    from '@/lib/hub/utils';
import { PiPrice }   from '@/lib/hub/types';

interface Props {
  balance:  string;
  piPrice:  PiPrice | null;
}

export function HubWalletCard({ balance, piPrice }: Props) {
  const router  = useRouter();
  const priceUp = (piPrice?.change24h ?? 0) >= 0;

  return (
    <div style={{ padding: '20px 16px 0', animation: 'tec-fade-in 0.4s ease both' }}>
      <button className="tec-btn"
        onClick={() => { haptic('light'); router.push('/dashboard/wallet'); }}
        style={{
          width: '100%', borderRadius: 24, overflow: 'hidden',
          background: 'linear-gradient(135deg,#0f0c1e 0%,#0a1628 50%,#0c1a0e 100%)',
          border: '1px solid rgba(212,175,55,0.15)',
          padding: '24px', cursor: 'pointer', textAlign: 'left',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          position: 'relative',
        }}>
        {/* Glow */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 24, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 80% 60% at 20% 50%, rgba(212,175,55,0.06) 0%, transparent 70%)',
        }} />

        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12, fontWeight: 600 }}>
            PI WALLET BALANCE
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
            {balance === '—' ? (
              <div className="tec-skeleton" style={{ width: 120, height: 44 }} />
            ) : (
              <>
                <span style={{ fontSize: 42, fontWeight: 900, color: '#d4af37', letterSpacing: -2, lineHeight: 1 }}>{balance}</span>
                <span style={{ fontSize: 22, color: 'rgba(212,175,55,0.6)', fontWeight: 300 }}>π</span>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="tec-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>View transactions →</span>
            </div>
            {piPrice && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: priceUp ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                border: `1px solid ${priceUp ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                borderRadius: 999, padding: '3px 10px',
              }}>
                <span style={{ fontSize: 10, color: priceUp ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                  {priceUp ? '▲' : '▼'} {Math.abs(piPrice.change24h).toFixed(2)}%
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>${piPrice.price.toFixed(4)}</span>
              </div>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}
