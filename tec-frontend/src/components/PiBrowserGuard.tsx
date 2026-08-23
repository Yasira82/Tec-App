'use client';

import { usePiBrowser } from '@/lib-client/hooks/usePiBrowser';
import { Icon }         from '@/components/ui/Icon';

interface Props {
  children:     React.ReactNode;
  showWarning?: boolean;
}

const s = (style: React.CSSProperties) => style;

/** Where a Pi deep link should actually land. */
const PI_DEEP_LINK = 'pi://hub.tecosystem.app';

export default function PiBrowserGuard({ children, showWarning = true }: Props) {
  const { isPiBrowser, isReady } = usePiBrowser();

  if (!isReady) return <>{children}</>;

  if (!isPiBrowser && showWarning) {
    return (
      <>
        {/*
          In the normal flow, NOT `position: fixed`.

          It used to be fixed at top:0 / z-index 9999 with a 52px spacer under
          it. The spacer keeps the FIRST paint clear, but the Hub header is
          `position: sticky; top: 0` — a sticky element docks to the viewport,
          not to the padded wrapper — so the moment you scrolled, the header
          slid underneath the banner and the account chip disappeared behind it.

          A banner that says "you are in the wrong browser" is read once. It
          does not need to hold the top of the screen forever, and the cost of
          it doing so was covering the app's own chrome.
        */}
        <div style={s({
          background:     'var(--tec-surface-1)',
          borderBottom:   '1px solid var(--tec-border-gold)',
          padding:        '10px 16px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          gap:            12,
        })}>
          <div style={s({ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 })}>
            <Icon name="alert" size={20} color="var(--tec-gold)" strokeWidth={1.9} />
            <div style={s({ minWidth: 0 })}>
              <div style={s({ fontSize: 13, fontWeight: 700, color: 'var(--tec-gold)' })}>
                Open in Pi Browser for full experience
              </div>
              <div style={s({ fontSize: 11, color: 'var(--tec-text-3)', marginTop: 2 })}>
                Payments require Pi Browser &middot; Search &ldquo;TEC&rdquo; in Pi Network app
              </div>
            </div>
          </div>
          <a
            href={PI_DEEP_LINK}
            style={s({
              background:     'var(--tec-gold-dim)',
              border:         '1px solid var(--tec-border-gold)',
              borderRadius:   8,
              padding:        '6px 12px',
              color:          'var(--tec-gold)',
              fontSize:       12,
              fontWeight:     700,
              textDecoration: 'none',
              whiteSpace:     'nowrap',
              flexShrink:     0,
            })}>
            Open App →
          </a>
        </div>
        {children}
      </>
    );
  }

  return <>{children}</>;
}
