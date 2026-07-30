'use client';

import { useRef }       from 'react';
import { haptic }       from '@/lib/hub/utils';
import { PiPrice }      from '@/lib/hub/types';
import { CountUp }      from '@/components/ui/CountUp';

// Hub top spotlight. Marketing-first: slide 1 = the Founding-100 "missions" entry,
// slide 2 = Invite & Earn (referral), slide 3 = the live Pi price. The old
// "apps live on Pi" slide was removed — it linked to the same Pioneers page as
// Founding-100 (a duplicate); app discovery lives in the apps grid / nav.
interface Props {
  carouselIdx:    number;
  setCarouselIdx: (i: number) => void;
  piPrice:        PiPrice | null;
  goToPioneers:   () => void;
  goToReferral:   () => void;
}

const SLIDES = 3;

export function HubCarousel({ carouselIdx, setCarouselIdx, piPrice, goToPioneers, goToReferral }: Props) {
  const touchStartX = useRef(0);
  const priceUp     = (piPrice?.change24h ?? 0) >= 0;

  return (
    <div style={{ padding: '14px 16px 0', animation: 'tec-fade-in 0.5s ease both' }}>
      <div
        onTouchStart={e => { touchStartX.current = e.targetTouches[0].clientX; }}
        onTouchEnd={e => {
          const diff = touchStartX.current - e.changedTouches[0].clientX;
          if (Math.abs(diff) > 40) { haptic('light'); setCarouselIdx(diff > 0 ? Math.min(carouselIdx + 1, SLIDES - 1) : Math.max(carouselIdx - 1, 0)); }
        }}
        style={{ overflow: 'hidden', borderRadius: 20 }}>
        <div style={{ display: 'flex', transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1)', transform: `translateX(-${carouselIdx * 100}%)` }}>

          {/* 1 — Founding 100 · Marketing missions entry */}
          <div style={{ minWidth: '100%' }}>
            <button className="tec-btn" onClick={goToPioneers}
              style={{ width: '100%', borderRadius: 20, background: 'linear-gradient(135deg, rgba(251,191,36,0.14), #111627)', border: '1px solid rgba(251,191,36,0.3)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                <div style={{ width: 48, height: 48, borderRadius: 16, flex: '0 0 auto', background: 'linear-gradient(135deg,#1a1208,#111627)', border: '1px solid rgba(251,191,36,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#FBBF24' }}>★</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 3 }}>Founding 100</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>Start your Pioneer missions — earn the badge</div>
                </div>
              </div>
              <div style={{ flex: '0 0 auto', fontSize: 9, fontWeight: 800, color: '#FBBF24', letterSpacing: 1.5 }}>START →</div>
            </button>
          </div>

          {/* 2 — Invite & Earn (referral growth) */}
          <div style={{ minWidth: '100%' }}>
            <button className="tec-btn" onClick={goToReferral}
              style={{ width: '100%', borderRadius: 20, background: 'linear-gradient(135deg, rgba(34,197,94,0.14), #111627)', border: '1px solid rgba(34,197,94,0.28)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                <div style={{ width: 48, height: 48, borderRadius: 16, flex: '0 0 auto', background: 'linear-gradient(135deg,#0d2417,#111627)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎁</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 3 }}>Invite &amp; Earn</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>Invite a friend — you both get a free PRO month</div>
                </div>
              </div>
              <div style={{ flex: '0 0 auto', fontSize: 9, fontWeight: 800, color: '#22C55E', letterSpacing: 1.5 }}>INVITE →</div>
            </button>
          </div>

          {/* 3 — Pi Price (kept as-is) */}
          <div style={{ minWidth: '100%' }}>
            <div style={{ borderRadius: 20, background: '#111627', border: '1px solid rgba(251,191,36,0.12)', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg,#1a1208,#111627)', border: '1px solid rgba(251,191,36,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: '#FBBF24' }}>π</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Pi Network</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>PI/USDT · OKX</div>
                  </div>
                </div>
                {piPrice
                  ? <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 24, fontWeight: 900, color: '#FBBF24', fontVariantNumeric: 'tabular-nums' }}>$<CountUp value={piPrice.price} decimals={4} duration={700} /></div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: priceUp ? '#22C55E' : '#ef4444' }}>{priceUp ? '▲' : '▼'} {Math.abs(piPrice.change24h).toFixed(2)}%</div>
                    </div>
                  : <div className="tec-skeleton" style={{ width: 80, height: 40 }} />
                }
              </div>
              {piPrice
                ? <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: '24H HIGH', value: `$${piPrice.high24h.toFixed(4)}`, color: '#22C55E' },
                      { label: '24H LOW',  value: `$${piPrice.low24h.toFixed(4)}`,  color: '#ef4444' },
                    ].map(s => (
                      <div key={s.label} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5, marginBottom: 4 }}>{s.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div className="tec-skeleton" style={{ height: 48 }} />
                    <div className="tec-skeleton" style={{ height: 48 }} />
                  </div>
              }
            </div>
          </div>
        </div>
      </div>

      {/* Dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 10 }}>
        {Array.from({ length: SLIDES }, (_, i) => i).map(i => (
          <button key={i} onClick={() => { haptic('light'); setCarouselIdx(i); }}
            aria-label={`Slide ${i + 1}`}
            style={{
              width: carouselIdx === i ? 20 : 6, height: 6, borderRadius: 3,
              background: carouselIdx === i ? '#FBBF24' : 'rgba(255,255,255,0.15)',
              border: 'none', cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)', padding: 0,
            }} />
        ))}
      </div>
    </div>
  );
}
