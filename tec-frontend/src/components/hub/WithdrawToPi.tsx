'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { bffFetch } from '@/lib-client/pi/bff-client';
import { getPiAccessToken } from '@/lib-client/pi/pi-auth';
import { haptic } from '@/lib/hub/utils';

/**
 * TEC balance → the person's own Pi Network wallet (tec-core-backend #400).
 *
 * Renders NOTHING unless wallet-service says withdrawals are open for this account
 * (closed by default — an allowlist). The Pi sign-in happens on the tap: it decides
 * which Pi account is paid (the services refuse anyone but the signed-in person) and
 * proves the person is here. One request id per attempt, so a double tap or a retry
 * is answered with the first result instead of a second payout.
 */

export interface WithdrawStatus { open: boolean; balance: string; maxPi: number; dailyLeft: string; pending: boolean }
type Result = { status: 'completed' | 'processing' | 'failed'; amount: string; txid?: string | null; message?: string };

const AMOUNT = /^\d{1,6}(\.\d{1,7})?$/;

const csrf = (): string =>
  typeof document === 'undefined' ? '' :
  document.cookie.split('; ').find((r) => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';

export const withdrawAmountOk = (raw: string, s: Pick<WithdrawStatus, 'maxPi' | 'dailyLeft' | 'balance'>): boolean => {
  const v = raw.trim();
  if (!AMOUNT.test(v)) return false;
  const n = Number(v);
  return n > 0 && n <= s.maxPi && n <= Number(s.dailyLeft) && n <= Number(s.balance);
};

export function WithdrawToPi({ onOpenChange, onDone }: { onOpenChange?: (open: boolean) => void; onDone?: () => void }) {
  const { t } = useTranslation();
  const w = t.hub.wallet.withdraw;
  const [status, setStatus]   = useState<WithdrawStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount]   = useState('');
  const [busy, setBusy]       = useState(false);
  const [note, setNote]       = useState<{ ok: boolean; text: string } | null>(null);
  const requestId = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await bffFetch('/api/bff/wallet/withdraw', { cache: 'no-store' });
      const s   = res.ok ? ((await res.json()) as WithdrawStatus) : null;
      setStatus(s);
      onOpenChange?.(Boolean(s?.open));
    } catch {
      setStatus(null);
    }
  }, [onOpenChange]);

  useEffect(() => { void load(); }, [load]);

  if (!status?.open) return null;

  const valid = withdrawAmountOk(amount, status);

  const submit = async () => {
    if (!valid || busy) return;
    haptic('medium');
    setBusy(true);
    setNote({ ok: true, text: w.working });
    // One id per attempt: kept across a retry of THIS attempt, new for the next.
    requestId.current ??= crypto.randomUUID();
    try {
      const piAccessToken = await getPiAccessToken();
      const res = await bffFetch('/api/bff/wallet/withdraw', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() },
        body:    JSON.stringify({ amount: amount.trim(), piAccessToken, requestId: requestId.current }),
      });
      const data = (await res.json().catch(() => ({}))) as Result & { message?: string };
      if (!res.ok) {
        setNote({ ok: false, text: data?.message ?? w.failed });
        requestId.current = null;
      } else if (data.status === 'completed') {
        setNote({ ok: true, text: w.done.replace('{amount}', data.amount) });
        setAmount(''); setEditing(false); requestId.current = null;
        onDone?.();
      } else if (data.status === 'processing') {
        setNote({ ok: true, text: data.message ?? w.pending });
        requestId.current = null;
        onDone?.();
      } else {
        setNote({ ok: false, text: data.message ?? w.failed });
        requestId.current = null;
        onDone?.();
      }
    } catch {
      // The Pi sign-in was cancelled or timed out: nothing was sent. Keep the id —
      // trying again is the same attempt.
      setNote({ ok: false, text: w.failed });
    } finally {
      setBusy(false);
      void load();
    }
  };

  const limits = w.limits.replace('{max}', String(status.maxPi)).replace('{left}', status.dailyLeft);

  return (
    <div style={{ padding: '10px 16px 12px', borderTop: '1px solid var(--tec-border)' }}>
      {!editing ? (
        <button className="tec-btn" type="button" disabled={status.pending}
          onClick={() => { haptic('light'); setEditing(true); setNote(null); }}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 12, fontSize: 13, fontWeight: 600,
            background: 'transparent', color: 'var(--tec-gold)', border: '1px solid var(--tec-border-gold)',
            opacity: status.pending ? 0.5 : 1,
          }}>
          {status.pending ? w.pending : w.button}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--tec-text-2)' }}>
            {w.amount}
            <input inputMode="decimal" value={amount} disabled={busy}
              onChange={(e) => setAmount(e.target.value.replace(',', '.'))}
              placeholder="0"
              style={{
                display: 'block', width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 10,
                background: 'var(--tec-surface-2)', color: 'var(--tec-text-1)', border: '1px solid var(--tec-border)', fontSize: 16,
              }} />
          </label>
          <div style={{ fontSize: 10, color: 'var(--tec-text-3)' }}>{limits}</div>
          {amount && !valid && (
            <div style={{ fontSize: 11, color: 'var(--tec-red)' }}>{w.invalid.replace('{max}', String(status.maxPi))}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="tec-btn" type="button" disabled={busy}
              onClick={() => { setEditing(false); setAmount(''); setNote(null); requestId.current = null; }}
              style={{ flex: 1, padding: '10px 12px', borderRadius: 12, fontSize: 13, background: 'transparent', color: 'var(--tec-text-2)', border: '1px solid var(--tec-border)' }}>
              {w.cancel}
            </button>
            <button className="tec-btn" type="button" disabled={!valid || busy} onClick={submit}
              style={{ flex: 2, padding: '10px 12px', borderRadius: 12, fontSize: 13, fontWeight: 700, background: 'var(--tec-gold)', color: '#000', border: 'none', opacity: !valid || busy ? 0.5 : 1 }}>
              {busy ? w.working : w.confirm}
            </button>
          </div>
        </div>
      )}
      {note && (
        <div role="status" style={{ marginTop: 8, fontSize: 11, color: note.ok ? 'var(--tec-text-2)' : 'var(--tec-red)' }}>{note.text}</div>
      )}
    </div>
  );
}
