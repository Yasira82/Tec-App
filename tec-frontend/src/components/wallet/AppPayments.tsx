'use client';

import { useTranslation, bcp47 } from '@/lib/i18n';
import { formatTxDate, type Payment } from '@/lib/dashboard-data';
import { paymentAppName, paymentKind, type PaymentKind } from '@/lib/hub/payment-app';

/**
 * Pi payments to TEC apps — what the π went to, by app.
 *
 * Lives on the wallet page (moved off the Hub's home card, owner 2026-10-16): the Hub
 * card is the balance at a glance, and every money list belongs in one place. This is
 * NOT the internal-ledger history above it — those are TEC-balance moves; these are Pi
 * paid through the Pi SDK to an app (payment-service).
 *
 * `null` (not loaded / failed) renders nothing — never an empty list that would read as
 * "you have paid nothing".
 */
const KIND_COLOR: Record<PaymentKind, string> = {
  completed: 'var(--tec-green)',
  pending:   'var(--tec-gold)',
  failed:    'var(--tec-red)',
  cancelled: 'var(--tec-text-3)',
};

export function AppPayments({ payments }: { payments: Payment[] | null }) {
  const { t, dir, locale: uiLocale } = useTranslation();
  const locale = dir === 'rtl' ? 'ar' : 'en';
  if (!payments) return null;

  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--tec-text-3)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>
        {t.hub.wallet.recentTitle}
      </div>
      {payments.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--tec-text-3)', padding: '6px 0 6px' }}>{t.hub.wallet.recentEmpty}</div>
      ) : payments.map((p, i) => {
        const kind = paymentKind(p.status);
        const when = formatTxDate(p.createdAt, bcp47(uiLocale));
        return (
          <div key={p.id || i}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
              borderTop: i === 0 ? 'none' : '1px solid var(--tec-border)',
            }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--tec-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {paymentAppName(p.source, locale) ?? t.hub.wallet.paymentGeneric}
              </span>
              {when && <span style={{ display: 'block', fontSize: 10, color: 'var(--tec-text-3)', marginTop: 2 }}>{when}</span>}
            </span>
            <span style={{ textAlign: 'end', flexShrink: 0 }}>
              <span dir="ltr" style={{ display: 'block', fontSize: 13, fontWeight: 800, color: 'var(--tec-text-1)', fontVariantNumeric: 'tabular-nums' }}>
                {p.amount.toFixed(2)} π
              </span>
              <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: KIND_COLOR[kind], marginTop: 2 }}>
                {t.hub.wallet.status[kind]}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
