import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'TEC — The Elite Consortium';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: '#080810',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          fontFamily: 'serif',
        }}
      >
        {/* Gold grid pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(248,184,32,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(248,184,32,0.06) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
            display: 'flex',
          }}
        />

        {/* Top glow */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '800px',
            height: '400px',
            background: 'radial-gradient(ellipse, rgba(248,184,32,0.12) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Bottom glow */}
        <div
          style={{
            position: 'absolute',
            bottom: '-100px',
            left: '20%',
            width: '600px',
            height: '400px',
            background: 'radial-gradient(ellipse, rgba(100,130,200,0.07) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 20px',
            border: '1px solid rgba(248,184,32,0.25)',
            borderRadius: '100px',
            background: 'rgba(248,184,32,0.06)',
            marginBottom: '40px',
          }}
        >
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#F8B820',
              boxShadow: '0 0 8px #F8B820',
            }}
          />
          <span
            style={{
              fontSize: '14px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(248,184,32,0.7)',
            }}
          >
            Pi Network Ecosystem
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0px',
            marginBottom: '32px',
          }}
        >
          <span
            style={{
              fontSize: '96px',
              fontWeight: 300,
              color: '#e8e0d0',
              letterSpacing: '-0.02em',
              lineHeight: '1',
            }}
          >
            The Elite
          </span>
          <span
            style={{
              fontSize: '96px',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #f5d060, #F8B820, #a08020)',
              backgroundClip: 'text',
              color: 'transparent',
              letterSpacing: '-0.02em',
              lineHeight: '1',
            }}
          >
            Consortium
          </span>
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: '20px',
            color: 'rgba(232,224,208,0.45)',
            letterSpacing: '0.08em',
            marginBottom: '48px',
          }}
        >
          24 sovereign apps · One identity · One wallet · One world
        </p>

        {/* Stats */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0',
            border: '1px solid rgba(248,184,32,0.1)',
            borderRadius: '16px',
            overflow: 'hidden',
            background: 'rgba(248,184,32,0.02)',
          }}
        >
          {[
            { num: '24', label: 'Apps' },
            { num: '47M+', label: 'Pi Users' },
            { num: '1', label: 'Identity' },
          ].map((stat, i) => (
            <div key={stat.label} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && (
                <div
                  style={{
                    width: '1px',
                    height: '40px',
                    background: 'rgba(248,184,32,0.12)',
                  }}
                />
              )}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '20px 48px',
                }}
              >
                <span
                  style={{
                    fontSize: '40px',
                    fontWeight: 600,
                    color: '#F8B820',
                    lineHeight: '1',
                  }}
                >
                  {stat.num}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: 'rgba(232,224,208,0.35)',
                  }}
                >
                  {stat.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Domain */}
        <p
          style={{
            position: 'absolute',
            bottom: '32px',
            right: '40px',
            fontSize: '13px',
            color: 'rgba(248,184,32,0.3)',
            letterSpacing: '0.1em',
          }}
        >
          tec.pi · tec-app.vercel.app
        </p>
      </div>
    ),
    { ...size }
  );
}
