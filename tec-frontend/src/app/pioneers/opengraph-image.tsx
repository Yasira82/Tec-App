import { ImageResponse } from 'next/og';
import { LIVE_DOMAINS } from '@/domains/_registry';

// Social share card for /pioneers — the link itself IS a marketing asset. The app
// count is derived from the LIVE domain registry (single source of truth) so the
// card never claims a number that isn't real. Same EVL visual language as the root
// OG card. Next wires this as og:image (and twitter:image via twitter-image.tsx).
export const runtime = 'edge';
export const alt = 'TEC Founding 100 — become a Founding Pioneer on Pi';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function PioneersOG() {
  const count = LIVE_DOMAINS.length;
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: '#050816',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          fontFamily: 'serif',
        }}
      >
        {/* Gold grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(251,191,36,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,0.06) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
            display: 'flex',
          }}
        />
        {/* Top glow */}
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '820px',
            height: '420px',
            background: 'radial-gradient(ellipse, rgba(139,92,246,0.16) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Founding badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 22px',
            border: '1px solid rgba(251,191,36,0.3)',
            borderRadius: '100px',
            background: 'rgba(251,191,36,0.07)',
            marginBottom: '36px',
          }}
        >
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FBBF24', boxShadow: '0 0 10px #FBBF24', display: 'flex' }} />
          <span
            style={{
              fontSize: '15px',
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: 'rgba(251,191,36,0.85)',
            }}
          >
            Founding 100 · Live on Pi Mainnet
          </span>
        </div>

        {/* Title */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px' }}>
          <span style={{ fontSize: '82px', fontWeight: 300, color: '#E5E7EB', letterSpacing: '-0.02em', lineHeight: 1 }}>
            Become a TEC
          </span>
          <span
            style={{
              fontSize: '92px',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #FCD34D, #FBBF24, #F59E0B)',
              backgroundClip: 'text',
              color: 'transparent',
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
            }}
          >
            Founding Pioneer
          </span>
        </div>

        {/* Sub */}
        <p style={{ fontSize: '22px', color: 'rgba(229,231,235,0.55)', letterSpacing: '0.04em', marginBottom: '44px' }}>
          A full economy on Pi · {count} apps · one identity · real Pi payments
        </p>

        {/* Stats */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            border: '1px solid rgba(251,191,36,0.12)',
            borderRadius: '16px',
            overflow: 'hidden',
            background: 'rgba(251,191,36,0.02)',
          }}
        >
          {[
            { num: String(count), label: 'Apps live' },
            { num: '100', label: 'Founding spots' },
            { num: '1', label: 'Pi identity' },
          ].map((s, i) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && <div style={{ width: '1px', height: '44px', background: 'rgba(251,191,36,0.12)' }} />}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '20px 52px' }}>
                <span style={{ fontSize: '44px', fontWeight: 600, color: '#FBBF24', lineHeight: 1 }}>{s.num}</span>
                <span style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(229,231,235,0.4)' }}>
                  {s.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        <p style={{ position: 'absolute', bottom: '32px', right: '44px', fontSize: '13px', color: 'rgba(251,191,36,0.35)', letterSpacing: '0.1em' }}>
          hub.tecosystem.app/pioneers
        </p>
      </div>
    ),
    { ...size }
  );
}
