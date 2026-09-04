'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';

const MAX = 2000;
const MIN = 3;

/**
 * "Tell us what you think" — and it goes somewhere.
 *
 * Posts to `/api/bff/feedback`, which forwards to the feedback module in
 * `tec-identity-service`. It deliberately does not open Telegram: a link out
 * is cheaper to build and loses the two things that make a report useful — the
 * app it came from, and the person still being inside the app as they write.
 *
 * Painted with CSS custom properties, not hex literals: a colour decided at
 * render cannot follow the theme (C-83 §5.5).
 */
export function FeedbackCard({ page }: { page?: string }) {
  const { t } = useTranslation();
  const f = t.feedback;

  const [message, setMessage] = useState('');
  const [state, setState]     = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError]     = useState<string | null>(null);

  const trimmed = message.trim();
  const tooLong = trimmed.length > MAX;
  const ready   = trimmed.length >= MIN && !tooLong;

  const submit = async () => {
    // The button is never disabled on invalid input — a control that refuses
    // in silence is the one form of validation a person cannot read. It says
    // WHY instead.
    if (!ready) {
      setError(tooLong ? f.tooLong.replace('{n}', String(trimmed.length)) : f.tooShort);
      return;
    }
    setState('sending');
    setError(null);
    try {
      const res = await fetch('/api/bff/feedback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: trimmed, page }),
        credentials: 'include',
      });
      if (!res.ok) {
        // Prefer the server's own sentence — it knows which rule was broken,
        // and the hourly limit is not something the client can see.
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || data?.message || data?.error || f.failed);
      }
      setState('sent');
      setMessage('');
    } catch (err) {
      setState('idle');
      setError((err as Error).message || f.failed);
    }
  };

  if (state === 'sent') {
    return (
      <div style={{
        background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
        borderRadius: 'var(--radius-md)', padding: 'var(--sp-4) var(--sp-5)',
      }}>
        <div style={{ color: 'var(--tec-green)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>{f.thanks}</div>
        {/* Says what happens next. "Thanks!" alone reads as a receipt printer. */}
        <div style={{ color: 'var(--tec-text-3)', fontSize: 'var(--text-xs)', marginTop: 4, lineHeight: 1.55 }}>
          {f.thanksHint}
        </div>
        <button
          onClick={() => setState('idle')}
          style={{
            marginTop: 10, background: 'none', border: 'none', padding: 0,
            color: 'var(--tec-gold)', fontSize: 'var(--text-xs)', fontWeight: 700,
            cursor: 'pointer', font: 'inherit',
          }}
        >
          {f.sendAnother}
        </button>
      </div>
    );
  }

  return (
    <div>
      <textarea
        value={message}
        onChange={(e) => { setMessage(e.target.value); if (error) setError(null); }}
        placeholder={f.placeholder}
        aria-label={f.title}
        rows={4}
        // Typing past the cap is not blocked at the keystroke — a textarea that
        // stops accepting characters mid-sentence feels broken. The counter
        // turns red first, and the error explains on submit.
        style={{
          width: '100%', boxSizing: 'border-box', resize: 'vertical',
          background: 'var(--tec-fill-soft)',
          border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'var(--tec-border)'}`,
          borderRadius: 'var(--radius-md)', padding: 'var(--sp-3) var(--sp-4)',
          color: 'var(--tec-text-1)', fontSize: 'var(--text-sm)', lineHeight: 1.55,
          font: 'inherit', outline: 'none',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <span dir="ltr" style={{
          fontSize: 'var(--text-xs)',
          color: tooLong ? 'var(--tec-red)' : 'var(--tec-text-3)',
          fontWeight: tooLong ? 700 : 500,
        }}>
          {trimmed.length} / {MAX}
        </span>
        <span style={{ flex: 1 }} />
        <button
          onClick={() => { void submit(); }}
          disabled={state === 'sending'}
          style={{
            background: 'linear-gradient(135deg,var(--tec-gold),var(--tec-gold-dark))',
            color: 'var(--tec-on-gold)', border: 'none', borderRadius: 'var(--radius-md)',
            padding: '9px 20px', fontSize: 'var(--text-sm)', fontWeight: 800,
            cursor: state === 'sending' ? 'default' : 'pointer',
            opacity: state === 'sending' ? 0.6 : 1, font: 'inherit',
          }}
        >
          {state === 'sending' ? f.sending : f.send}
        </button>
      </div>

      {error && (
        <div role="alert" style={{
          marginTop: 8, color: 'var(--tec-red)', fontSize: 'var(--text-xs)', lineHeight: 1.5,
        }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', lineHeight: 1.55 }}>
        {/* What is attached, said BEFORE they type. A report that silently
            carried the screen they were on would be a small surprise. */}
        {f.privacyNote}
      </div>
    </div>
  );
}
