'use client';

import { useState } from 'react';

/**
 * "Not going to finish? One tap tells us why." — the Round 3 decision
 * (KB audits/ROUND_3_DISCOVERY_DECISION_2026-10-04.md): instead of chasing the
 * people who stopped, ask everyone who is about to, on the page they stop on.
 *
 * Five reasons (the 2026-08-16 interview's a–e) and an optional note. Their answer
 * is shown back so the card never asks twice, and can be changed.
 */
export type StopReason = 'a' | 'b' | 'c' | 'd' | 'e';

export interface StopReasonStrings {
  title:   string;
  reasons: Record<StopReason, string>;
  note:    string;
  send:    string;
  thanks:  string;
  change:  string;
  failed:  string;
}

export function StopReasonCard({ strings: s, initial, onSaved }: {
  strings:  StopReasonStrings;
  initial:  { reason: StopReason; note: string | null } | null;
  onSaved?: () => void;
}) {
  const [saved,  setSaved]  = useState(initial);
  const [pick,   setPick]   = useState<StopReason | null>(initial?.reason ?? null);
  const [note,   setNote]   = useState(initial?.note ?? '');
  const [open,   setOpen]   = useState(!initial);
  const [busy,   setBusy]   = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const send = async () => {
    if (!pick || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/bff/campaign/stop-reason', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: pick, ...(note.trim() ? { note: note.trim() } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? data?.error ?? s.failed);
      setSaved({ reason: pick, note: note.trim() || null });
      setOpen(false);
      onSaved?.();
    } catch (e) {
      setError((e as Error).message || s.failed);
    } finally {
      setBusy(false);
    }
  };

  const box = {
    marginTop: 'var(--sp-5)', padding: 'var(--sp-4)', borderRadius: 14,
    border: '1px solid var(--tec-border)', background: 'var(--tec-surface-1)',
  } as const;

  if (!open && saved) {
    return (
      <div style={box} data-testid="stop-reason-saved">
        <div style={{ fontSize: 13, color: 'var(--tec-text-2)', lineHeight: 1.6 }}>{s.thanks}</div>
        <div style={{ fontSize: 12.5, color: 'var(--tec-text-3)', marginTop: 6 }}>
          {s.reasons[saved.reason]}{saved.note ? ` — “${saved.note}”` : ''}
        </div>
        <button onClick={() => setOpen(true)}
          style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, color: 'var(--tec-gold)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', font: 'inherit' }}>
          {s.change}
        </button>
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--tec-text-1)', marginBottom: 'var(--sp-3)' }}>{s.title}</div>
      <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(Object.keys(s.reasons) as StopReason[]).map((r) => (
          <button key={r} role="radio" aria-checked={pick === r} onClick={() => setPick(r)}
            style={{
              textAlign: 'start', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', font: 'inherit', fontSize: 13,
              border: `1px solid ${pick === r ? 'var(--tec-gold)' : 'var(--tec-border)'}`,
              background: pick === r ? 'var(--tec-gold-dim)' : 'transparent',
              color: 'var(--tec-text-1)',
            }}>
            {s.reasons[r]}
          </button>
        ))}
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 280))} placeholder={s.note} rows={2}
        style={{ width: '100%', marginTop: 'var(--sp-3)', padding: 10, borderRadius: 10, border: '1px solid var(--tec-border)', background: 'transparent', color: 'var(--tec-text-1)', font: 'inherit', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
      <button onClick={() => { void send(); }} disabled={!pick || busy}
        style={{ marginTop: 'var(--sp-3)', width: '100%', padding: '11px 0', borderRadius: 12, border: 'none', cursor: pick && !busy ? 'pointer' : 'default', background: 'var(--tec-gold)', color: 'var(--tec-on-gold)', fontWeight: 800, fontSize: 13.5, opacity: pick && !busy ? 1 : 0.5 }}>
        {s.send}
      </button>
      {error && <div role="alert" style={{ marginTop: 8, color: 'var(--tec-red)', fontSize: 12.5 }}>{error}</div>}
    </div>
  );
}
