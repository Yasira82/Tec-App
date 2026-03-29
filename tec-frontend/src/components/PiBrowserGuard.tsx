'use client';

import { usePiBrowser } from '@/lib-client/hooks/usePiBrowser';

interface Props {
  children:     React.ReactNode;
  showWarning?: boolean;
}

const s = (style: React.CSSProperties) => style;

export default function PiBrowserGuard({ children, showWarning = true }: Props) {
  const { isPiBrowser, isReady } = usePiBrowser();

  if (!isReady) return <>{children}</>;

  if (!isPiBrowser && showWarning) {
    return (
      <>
        <div style={s({
          position:       'fixed',
          top:            0,
          left:           0,
          right:          0,
          zIndex:         9999,
          background:     'linear-gradient(135deg,#1a0f00,#2a1800)',
          border:         '1px solid #f0c04040',
          padding:        '10px 20px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          gap:            12,
        })}>
          <div style={s({ display: 'flex', alignItems: 'center', gap: 10 })}>
            <span style={s({ fontSize: 20 })}>⚠️</span>
            <div>
              <div style={s({ fontSize: 13, fontWeight: 700, color: '#f0c040' })}>
                Open in Pi Browser for full experience
              </div>
              <div style={s({ fontSize: 11, color: '#6b6b7a', marginTop: 2 })}>
                Payments require Pi Browser &middot; Search &ldquo;TEC&rdquo; in Pi Network app
              </div>
            </div>
          </div>
          <a
            href="pi://tec-app.vercel.app"
            style={s({
              background:     '#f0c04020',
              border:         '1px solid #f0c04040',
              borderRadius:   8,
              padding:        '6px 12px',
              color:          '#f0c040',
              fontSize:       12,
              fontWeight:     700,
              textDecoration: 'none',
              whiteSpace:     'nowrap',
            })}>
            Open App →
          </a>
        </div>
        <div style={s({ paddingTop: 52 })}>
          {children}
        </div>
      </>
    );
  }

  return <>{children}</>;
}
