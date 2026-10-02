'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';

/**
 * Back on the Hub from an app, with no session in this page.
 *
 * Since the grid opens apps on their own domain (tec-app #266), Android's Back
 * returns to a freshly loaded Hub that finds none of its cookies (C-123 §7).
 * It used to try a silent Pi sign-in, wait out its budget, and then leave for
 * the marketing page's "Sign in with Pi" — where one tap worked at once (owner,
 * phone, 2026-10-02). Pi answers the tap; it does not answer an authenticate
 * nobody asked for. So the tap is offered HERE, on the Hub, straight away.
 */
export function HubContinue({ onContinue }: { onContinue: () => Promise<unknown> }) {
  const { t } = useTranslation();
  const c = t.hub.continueBack;
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState(false);

  const go = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await onContinue();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--tec-bg)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 360, textAlign: 'center',
        background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border)',
        borderRadius: 20, padding: '28px 22px',
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--tec-text-1)', marginBottom: 8 }}>
          {c.title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--tec-text-2)', lineHeight: 1.6, marginBottom: 20 }}>
          {c.body}
        </div>
        <button
          onClick={go}
          disabled={busy}
          style={{
            width: '100%', padding: '14px 18px', borderRadius: 14, border: 'none',
            background: 'var(--tec-gold)', color: 'var(--tec-on-gold)',
            fontSize: 15, fontWeight: 800, cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? t.hub.signingIn : c.button}
        </button>
        {error && (
          <div role="alert" style={{ marginTop: 12, fontSize: 12, color: 'var(--tec-red, #ef4444)' }}>
            {c.failed}
          </div>
        )}
      </div>
    </div>
  );
}
