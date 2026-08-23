'use client';

import { useTranslation } from '@/lib/i18n';

import { useRouter } from 'next/navigation';
import { haptic }    from '@/lib/hub/utils';
import { PiPrice }   from '@/lib/hub/types';
import { CountUp }   from '@/components/ui/CountUp';
import { Icon }      from '@/components/ui/Icon';

interface Props {
  balance:         string;
  piPrice:         PiPrice | null;
  balanceError?:   boolean;
  onRetryBalance?: () => void;
}

export function HubWalletCard({ balance, piPrice, balanceError, onRetryBalance }: Props) {
  const { t } = useTranslation();
  const router  = useRouter();
  const priceUp = (piPrice?.change24h ?? 0) >= 0;

  // Fiat value of THIS balance, and what the last 24h of Pi's price did to it.
  // Null unless both halves are real: no price, no unloaded/failed balance, no
  // line — an "≈ $0.00" under a balance we could not read is a worse answer
  // than saying nothing.
  const piAmount = balanceError || balance === '—' ? NaN : parseFloat(balance);
  const fiat  = piPrice && Number.isFinite(piAmount) ? piAmount * piPrice.price : null;
  // change24h is the percentage the price moved, so the value 24h ago was
  // fiat / (1 + pct/100); the delta is the difference, not fiat × pct.
  const delta = fiat !== null && piPrice
    ? fiat - fiat / (1 + piPrice.change24h / 100)
    : null;

  // Primary wallet actions — surfaced on the home like every major fintech app.
  // They do NOT reimplement payment logic; each opens the REAL Send/Receive/history
  // flow on the wallet page (payment-service owns the transaction — P2/ADR-004).
  const go = (path: string) => { haptic('light'); router.push(path); };
  const ACTIONS = [
    { key: 'send',    label: t.hub.wallet.send,    icon: 'arrowUp'   as const, path: '/dashboard/wallet?action=send' },
    { key: 'receive', label: t.hub.wallet.receive, icon: 'arrowDown' as const, path: '/dashboard/wallet?action=receive' },
    { key: 'history', label: t.hub.wallet.history, icon: 'swap'      as const, path: '/dashboard/wallet' },
  ];

  return (
    <div style={{ padding: '20px 16px 0', animation: 'tec-fade-in 0.4s ease both' }}>
      {/*
        ONE card for the whole wallet.

        The balance, the three actions and the ledger note used to be four
        separate objects stacked with gaps: a card, then three individually
        bordered buttons, then a loose caption. Four boundaries for one idea —
        and the result was that the most important number on the Hub sat in a
        container with exactly the same visual weight as the Founding-100 promo
        next to it.

        Fixing that by giving the card its own colour is what --tec-hero tried,
        and it made this the one element that ignored the theme. Size is the
        honest tool: one boundary around a taller object outranks a small one
        without spending any colour.
      */}
      <div style={{
        borderRadius: 20, overflow: 'hidden',
        background: 'var(--tec-surface-1)',
        border: '1px solid var(--tec-border)',
      }}>
      <button className="tec-btn"
        onClick={() => { haptic('light'); router.push('/dashboard/wallet'); }}
        style={{
          width: '100%', background: 'none', border: 'none',
          padding: '15px 16px 14px', cursor: 'pointer', textAlign: 'start',
          display: 'block',
        }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--tec-text-3)', letterSpacing: 2.4, textTransform: 'uppercase', marginBottom: 5, fontWeight: 600 }}>
            {t.hub.wallet.internalBalance}
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 6 }}>
            {balanceError ? (
              // Honest failure state (C-135 §4) — never show a fabricated 0 balance.
              // A role=button span (not a real <button>) because the whole card is
              // already a <button> and nesting buttons is invalid HTML.
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); haptic('light'); onRetryBalance?.(); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault(); e.stopPropagation(); haptic('light'); onRetryBalance?.();
                  }
                }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.28)',
                  borderRadius: 12, padding: '9px 14px',
                }}
              >
                <span style={{ fontSize: 15, color: 'var(--tec-red)', fontWeight: 700 }}>{t.hub.wallet.loadFailed}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--tec-gold)', fontWeight: 700 }}>
                  <Icon name="refresh" size={13} color="var(--tec-gold)" strokeWidth={2.2} />{t.hub.wallet.retry}</span>
              </span>
            ) : balance === '—' ? (
              <div className="tec-skeleton" style={{ width: 120, height: 44 }} />
            ) : (
              <>
                <CountUp
                  value={parseFloat(balance) || 0}
                  decimals={2}
                  style={{ fontSize: 30, fontWeight: 900, color: 'var(--tec-gold)', letterSpacing: -1.2, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
                />
                <span style={{ fontSize: 17, color: 'rgba(var(--tec-gold-rgb),0.6)', fontWeight: 300 }}>π</span>
              </>
            )}
          </div>

          {/* What the balance is WORTH, and what it did — the two lines every
              exchange puts under the number.

              The chip here used to show Pi's own price and 24h change: true, but
              about the market rather than about this user, so it answered a
              question nobody standing on their own balance was asking. Both
              figures below are that same market data applied to THIS holding,
              so they are derived, not invented.

              It is labelled "24h market", never "profit": the user did not trade
              to earn or lose it, and calling a price move P&L on a page that
              also says the π cannot be withdrawn would be two mixed messages. */}
          {fiat !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--tec-text-2)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                ≈ ${fiat.toFixed(2)}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: priceUp ? 'var(--tec-green)' : 'var(--tec-red)', fontVariantNumeric: 'tabular-nums' }}>
                <Icon name={priceUp ? 'caretUp' : 'caretDown'} size={11}
                      color={priceUp ? 'var(--tec-green)' : 'var(--tec-red)'} strokeWidth={2.6} />
                {priceUp ? '+' : '−'}${Math.abs(delta!).toFixed(2)}
                <span style={{ opacity: 0.85 }}>({Math.abs(piPrice!.change24h).toFixed(2)}%)</span>
              </span>
              <span style={{ fontSize: 10, color: 'var(--tec-text-3)' }}>{t.hub.wallet.market24h}</span>
            </div>
          )}

          {/* Disclosure — this is an internal TEC ledger balance, NOT the user's real
              Pi Network wallet. No A2U/withdrawal path exists (payment-service is the
              only Pi custodian — C-47 Invariant #8). Stating it plainly avoids any
              impression that this π can be moved to a Pi Network wallet. */}
          <div style={{ fontSize: 10, color: 'var(--tec-text-3)', lineHeight: 1.4, marginBottom: 8 }}>
            {t.hub.wallet.notPiWallet}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="tec-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--tec-green)', display: 'inline-block' }} />
            <span style={{ fontSize: 11, color: 'var(--tec-text-2)' }}>{t.hub.wallet.viewTransactions} →</span>
          </div>
        </div>
      </button>

      {/* Quick actions — open the real wallet Send/Receive/history flow.
          Segments of the same card: hairlines instead of three more borders. */}
      <div style={{ display: 'flex', borderTop: '1px solid var(--tec-border)' }}>
        {ACTIONS.map((a, i) => (
          <button key={a.key} className="tec-btn" onClick={() => go(a.path)} aria-label={a.label}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              padding: '13px 0', cursor: 'pointer',
              background: 'none', border: 'none',
              borderInlineStart: i === 0 ? 'none' : '1px solid var(--tec-border)',
            }}>
            <Icon name={a.icon} size={17} color="var(--tec-gold)" strokeWidth={2.2} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tec-text-1)', letterSpacing: 0.3 }}>{a.label}</span>
          </button>
        ))}
      </div>

      {/* Send/Receive move π between TEC accounts on the internal ledger — they do
          NOT send to a Pi Network wallet. Kept explicit so the actions aren't mistaken
          for on-chain Pi transfers. Inside the card, because it describes the row
          directly above it — as a loose caption underneath it read as a footnote
          for the whole page. */}
      <div style={{
        fontSize: 10, color: 'var(--tec-text-3)', textAlign: 'center',
        padding: '9px 12px', borderTop: '1px solid var(--tec-border)',
      }}>
        {t.hub.wallet.internalOnly}
      </div>
      </div>
    </div>
  );
}
