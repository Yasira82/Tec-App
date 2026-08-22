'use client';

import { useTranslation } from '@/lib/i18n';

import { useRouter } from 'next/navigation';
import { haptic }    from '@/lib/hub/utils';
import { PiPrice }   from '@/lib/hub/types';
import { CountUp }   from '@/components/ui/CountUp';

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

  // Primary wallet actions — surfaced on the home like every major fintech app.
  // They do NOT reimplement payment logic; each opens the REAL Send/Receive/history
  // flow on the wallet page (payment-service owns the transaction — P2/ADR-004).
  const go = (path: string) => { haptic('light'); router.push(path); };
  const ACTIONS = [
    { key: 'send',    label: 'Send',    icon: '↑', path: '/dashboard/wallet?action=send' },
    { key: 'receive', label: 'Receive', icon: '↓', path: '/dashboard/wallet?action=receive' },
    { key: 'history', label: 'History', icon: '⇄', path: '/dashboard/wallet' },
  ];

  return (
    <div style={{ padding: '20px 16px 0', animation: 'tec-fade-in 0.4s ease both' }}>
      <button className="tec-btn"
        onClick={() => { haptic('light'); router.push('/dashboard/wallet'); }}
        style={{
          width: '100%', borderRadius: 24, overflow: 'hidden',
          background: 'linear-gradient(135deg,#0f0c1e 0%,#0a1628 50%,#0c1a0e 100%)',
          border: '1px solid rgba(251,191,36,0.15)',
          padding: '24px', cursor: 'pointer', textAlign: 'left',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          position: 'relative',
        }}>
        {/* Glow — dual-tone EVL (WEALTH gold + a cool accent) for depth */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 24, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 80% 60% at 18% 35%, rgba(251,191,36,0.09) 0%, transparent 62%), radial-gradient(ellipse 70% 60% at 95% 100%, rgba(6,182,212,0.07) 0%, transparent 60%)',
        }} />

        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12, fontWeight: 600 }}>
            TEC INTERNAL BALANCE
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
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
                <span style={{ fontSize: 15, color: '#f87171', fontWeight: 700 }}>{t.hub.wallet.loadFailed}</span>
                <span style={{ fontSize: 12, color: '#FBBF24', fontWeight: 700 }}>↻ Retry</span>
              </span>
            ) : balance === '—' ? (
              <div className="tec-skeleton" style={{ width: 120, height: 44 }} />
            ) : (
              <>
                <CountUp
                  value={parseFloat(balance) || 0}
                  decimals={2}
                  style={{ fontSize: 42, fontWeight: 900, color: '#FBBF24', letterSpacing: -2, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
                />
                <span style={{ fontSize: 22, color: 'rgba(251,191,36,0.6)', fontWeight: 300 }}>π</span>
              </>
            )}
          </div>

          {/* Disclosure — this is an internal TEC ledger balance, NOT the user's real
              Pi Network wallet. No A2U/withdrawal path exists (payment-service is the
              only Pi custodian — C-47 Invariant #8). Stating it plainly avoids any
              impression that this π can be moved to a Pi Network wallet. */}
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4, marginBottom: 14 }}>
            Not your Pi Network wallet · not withdrawable to Pi Network.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="tec-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{t.hub.wallet.viewTransactions} →</span>
            </div>
            {piPrice && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: priceUp ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                border: `1px solid ${priceUp ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                borderRadius: 999, padding: '3px 10px',
              }}>
                <span style={{ fontSize: 10, color: priceUp ? '#22C55E' : '#ef4444', fontWeight: 700 }}>
                  {priceUp ? '▲' : '▼'} {Math.abs(piPrice.change24h).toFixed(2)}%
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>${piPrice.price.toFixed(4)}</span>
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Quick actions — open the real wallet Send/Receive/history flow */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {ACTIONS.map(a => (
          <button key={a.key} className="tec-btn" onClick={() => go(a.path)} aria-label={a.label}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              padding: '11px 0', borderRadius: 16, cursor: 'pointer',
              background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.16)',
            }}>
            <span style={{ fontSize: 17, fontWeight: 900, color: '#FBBF24', lineHeight: 1 }}>{a.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.3 }}>{a.label}</span>
          </button>
        ))}
      </div>

      {/* Send/Receive move π between TEC accounts on the internal ledger — they do
          NOT send to a Pi Network wallet. Kept explicit so the actions aren't mistaken
          for on-chain Pi transfers. */}
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 8 }}>
        Send / Receive move π between TEC accounts only.
      </div>
    </div>
  );
}
