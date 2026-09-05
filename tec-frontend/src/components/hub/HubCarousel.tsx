'use client';

import { useTranslation } from '@/lib/i18n';

import { useRef }       from 'react';
import { haptic }       from '@/lib/hub/utils';
import { PiPrice }      from '@/lib/hub/types';
import { CountUp }      from '@/components/ui/CountUp';
import { Icon }         from '@/components/ui/Icon';

// Hub top spotlight. Marketing-first: the Pi reward campaign leads WHEN it is
// running, then the Founding-100 "missions" entry, Invite & Earn (referral), and
// the live Pi price. The old "apps live on Pi" slide was removed — it linked to
// the same Pioneers page as Founding-100 (a duplicate); app discovery lives in
// the apps grid / nav.
//
// The campaign leads because real Pi is a stronger draw than a badge, and it is
// time-boxed while Founding is permanent — the temporary thing is the one worth
// putting in front of somebody now.
interface Props {
  carouselIdx:    number;
  setCarouselIdx: (i: number) => void;
  piPrice:        PiPrice | null;
  goToPioneers:   () => void;
  goToReferral:   () => void;
  /** Only true while a round is actually open — see the slide count below. */
  campaignOpen?:  boolean;
  goToCampaign?:  () => void;
}

export function HubCarousel({
  carouselIdx, setCarouselIdx, piPrice, goToPioneers, goToReferral,
  campaignOpen = false, goToCampaign,
}: Props) {
  const { t, dir } = useTranslation();
  /**
   * The campaign slide only exists while a round is open, so the slide COUNT
   * has to move with it. It used to be the constant 3, which is exactly the
   * kind of thing that breaks quietly: a stale count either lets a swipe land
   * on a slide that is not there (a blank spotlight) or makes the last one
   * unreachable. Both look like the carousel is broken rather than like a
   * campaign that ended.
   */
  const showCampaign = campaignOpen && typeof goToCampaign === 'function';
  const SLIDES = showCampaign ? 4 : 3;
  /**
   * Clamped, because the count can SHRINK under a viewer: a round ends while
   * someone is parked on the last slide, and an unclamped index then points
   * past the track — a blank spotlight where the Hub's headline should be.
   */
  const idx = Math.min(Math.max(carouselIdx, 0), SLIDES - 1);
  // An RTL flex row starts at the RIGHT, so the slides advance the other way.
  // A fixed `translateX(-N%)` pushed the track off-screen and left the Hub's top
  // slot blank in Arabic — the carousel was there, just nowhere visible.
  const rtl = dir === 'rtl';
  const touchStartX = useRef(0);
  const priceUp     = (piPrice?.change24h ?? 0) >= 0;

  return (
    <div style={{ padding: '14px 16px 0', animation: 'tec-fade-in 0.5s ease both' }}>
      <div
        onTouchStart={e => { touchStartX.current = e.targetTouches[0].clientX; }}
        onTouchEnd={e => {
          const diff = touchStartX.current - e.changedTouches[0].clientX;
          // A swipe means "next" in the direction the user reads, so RTL inverts it.
          if (Math.abs(diff) > 40) {
            haptic('light');
            const forward = rtl ? diff < 0 : diff > 0;
            setCarouselIdx(forward ? Math.min(carouselIdx + 1, SLIDES - 1) : Math.max(carouselIdx - 1, 0));
          }
        }}
        style={{ overflow: 'hidden', borderRadius: 20 }}>
        <div style={{ display: 'flex', transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1)', transform: `translateX(${rtl ? '' : '-'}${idx * 100}%)` }}>

          {/* 0 — Pi reward campaign · only while a round is open */}
          {showCampaign && (
            <div style={{ minWidth: '100%' }}>
              <button className="tec-btn" onClick={goToCampaign}
                style={{ width: '100%', borderRadius: 20, background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border-gold)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'start', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 16, flex: '0 0 auto', background: 'var(--tec-gold-glow)', border: '1px solid var(--tec-border-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: 'var(--tec-gold)' }}>π</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--tec-text-1)', marginBottom: 3 }}>{t.hub.carousel.campaignTitle}</div>
                    <div style={{ fontSize: 11, color: 'var(--tec-text-3)', lineHeight: 1.4 }}>{t.hub.carousel.campaignSub}</div>
                  </div>
                </div>
                <div style={{ flex: '0 0 auto', fontSize: 9, fontWeight: 800, color: 'var(--tec-gold)', letterSpacing: 1.5 }}>{t.hub.carousel.campaignCta} →</div>
              </button>
            </div>
          )}

          {/* 1 — Founding 100 · Marketing missions entry */}
          <div style={{ minWidth: '100%' }}>
            <button className="tec-btn" onClick={goToPioneers}
              style={{ width: '100%', borderRadius: 20, background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'start', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                <div style={{ width: 48, height: 48, borderRadius: 16, flex: '0 0 auto', background: 'var(--tec-surface-2)', border: '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="star" size={22} color="var(--tec-gold)" strokeWidth={1.8} /></div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--tec-text-1)', marginBottom: 3 }}>{t.hub.carousel.foundingTitle}</div>
                  <div style={{ fontSize: 11, color: 'var(--tec-text-3)', lineHeight: 1.4 }}>{t.hub.carousel.foundingSub}</div>
                </div>
              </div>
              <div style={{ flex: '0 0 auto', fontSize: 9, fontWeight: 800, color: 'var(--tec-gold)', letterSpacing: 1.5 }}>{t.hub.carousel.foundingCta} →</div>
            </button>
          </div>

          {/* 2 — Invite & Earn (referral growth) */}
          <div style={{ minWidth: '100%' }}>
            <button className="tec-btn" onClick={goToReferral}
              style={{ width: '100%', borderRadius: 20, background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'start', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                <div style={{ width: 48, height: 48, borderRadius: 16, flex: '0 0 auto', background: 'var(--tec-surface-2)', border: '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="gift" size={22} color="var(--tec-green)" strokeWidth={1.8} /></div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--tec-text-1)', marginBottom: 3 }}>{t.hub.carousel.inviteTitle}</div>
                  <div style={{ fontSize: 11, color: 'var(--tec-text-3)', lineHeight: 1.4 }}>{t.hub.carousel.inviteSub}</div>
                </div>
              </div>
              <div style={{ flex: '0 0 auto', fontSize: 9, fontWeight: 800, color: 'var(--tec-green)', letterSpacing: 1.5 }}>{t.hub.carousel.inviteCta} →</div>
            </button>
          </div>

          {/* 3 — Pi Price (kept as-is) */}
          <div style={{ minWidth: '100%' }}>
            <div style={{ borderRadius: 20, background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border)', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 16, background: 'var(--tec-surface-2)', border: '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: 'var(--tec-gold)' }}>π</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tec-text-1)' }}>{t.hub.carousel.piNetwork}</div>
                    <div style={{ fontSize: 11, color: 'var(--tec-text-3)' }}>PI/USDT · OKX</div>
                  </div>
                </div>
                {piPrice
                  ? <div style={{ textAlign: 'end' }}>
                      <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--tec-gold)', fontVariantNumeric: 'tabular-nums' }}>$<CountUp value={piPrice.price} decimals={4} duration={700} /></div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: priceUp ? 'var(--tec-green)' : 'var(--tec-red)' }}>{priceUp ? '▲' : '▼'} {Math.abs(piPrice.change24h).toFixed(2)}%</div>
                    </div>
                  : <div className="tec-skeleton" style={{ width: 80, height: 40 }} />
                }
              </div>
              {piPrice
                ? <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: '24H HIGH', value: `$${piPrice.high24h.toFixed(4)}`, color: 'var(--tec-green)' },
                      { label: '24H LOW',  value: `$${piPrice.low24h.toFixed(4)}`,  color: 'var(--tec-red)' },
                    ].map(s => (
                      <div key={s.label} style={{ padding: '10px 12px', background: 'var(--tec-fill-softer)', borderRadius: 12 }}>
                        <div style={{ fontSize: 9, color: 'var(--tec-text-4)', letterSpacing: 1.5, marginBottom: 4 }}>{s.label}</div>
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
              width: idx === i ? 20 : 6, height: 6, borderRadius: 3,
              background: idx === i ? 'var(--tec-gold)' : 'var(--tec-border)',
              border: 'none', cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)', padding: 0,
            }} />
        ))}
      </div>
    </div>
  );
}
