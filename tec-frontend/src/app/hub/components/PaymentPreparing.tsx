'use client';

import { useTranslation } from '@/lib/i18n';

/**
 * The full-screen "Preparing payment…" splash shown while a Mode-1 payment
 * record is being created. Both states that render it — signed in with a
 * pending payment, and SSO still resolving — used to carry their own copy of
 * this markup, so a change to one silently diverged from the other.
 */
export function PaymentPreparing() {
  const { t } = useTranslation();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--tec-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--tec-gold-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: 'var(--tec-on-gold)' }}>T</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(251,191,36,0.2)', borderTopColor: 'var(--tec-gold)', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: 13, color: 'var(--tec-text-2)' }}>{t.hub.payment.preparing}</span>
      </div>
    </div>
  );
}
