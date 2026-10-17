'use client';

import { useState } from 'react';
import { usePiAuth }   from '@/lib-client/hooks/usePiAuth';
import { HubSubShell } from '@/components/hub';
import { Icon }        from '@/components/ui/Icon';

/**
 * Erase an account across services (tec-core-backend #437,
 * KB audits/ACCOUNT_ERASURE_PLAN_2026-10-17.md).
 *
 * The request arrives at privacy@tec.pi; it is carried out here. The dry run asks every
 * service what it would remove and changes nothing. The erasure needs the name typed again and
 * the request it answers, and is only offered after a dry run of the same name. A part that did
 * not answer is shown as not done — run it again: every part is idempotent. `role === 'admin'`
 * here is a courtesy; identity-service enforces it on the signed token.
 */

type Status = 'ok' | 'not_configured' | 'failed';
interface Part { service: string; status: Status; counts?: Record<string, number>; error?: string }
interface Report {
  username: string; applied: boolean; complete: boolean; participants: Part[];
  media: { found: number; purged: number; status: Status | 'none'; error?: string };
}

const message = (data: unknown, status: number) =>
  (data as { message?: string; error?: string })?.message ?? (data as { error?: string })?.error ?? `Failed (${status})`;

const summary = (c?: Record<string, number>) =>
  Object.entries(c ?? {}).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(' · ') || 'nothing';

export default function ErasurePage() {
  const { user, isLoading: authLoading } = usePiAuth();
  const isAdmin = (user as { role?: string } | null)?.role === 'admin';
  const [name, setName]     = useState('');
  const [plan, setPlan]     = useState<Report | null>(null);
  const [done, setDone]     = useState<Report | null>(null);
  const [typed, setTyped]   = useState('');
  const [ref, setRef]       = useState('');
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const dryRun = async () => {
    const username = name.trim();
    if (!username) return;
    setBusy(true); setError(null); setPlan(null); setDone(null); setTyped('');
    try {
      const res = await fetch(`/api/admin/erasure?username=${encodeURIComponent(username)}`, { credentials: 'include', cache: 'no-store' });
      if (res.status === 401 || res.status === 403) { setDenied(true); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(message(data, res.status));
      setPlan(data.data as Report);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const erase = async () => {
    if (!plan || typed !== plan.username || !ref.trim()) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/admin/erasure', {
        method: 'POST', credentials: 'include', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: plan.username, confirm: typed, ref: ref.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(message(data, res.status));
      setDone(data.data as Report); setPlan(null); setTyped('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const card  = { background: 'var(--tec-surface)', border: '1px solid var(--tec-border)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-4)', marginBottom: 'var(--sp-3)' } as const;
  const input = { display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10, background: 'var(--tec-surface-2)', color: 'var(--tec-text-1)', border: '1px solid var(--tec-border)', fontSize: 15 } as const;
  const color = (s: Status | 'none') => (s === 'ok' || s === 'none' ? 'var(--tec-green)' : 'var(--tec-red)');

  const parts = (r: Report, verb: string) => (
    <div style={{ display: 'grid', gap: 6 }}>
      {r.participants.map((p) => (
        <div key={p.service} style={{ fontSize: 13, color: p.status === 'ok' ? 'var(--tec-text-1)' : 'var(--tec-red)' }}>
          <b>{p.service}</b> — {p.status === 'ok' ? `${verb}: ${summary(p.counts)}` : `${p.status.replace('_', ' ')}${p.error ? ` (${p.error})` : ''}`}
        </div>
      ))}
      {r.applied && (
        <div style={{ fontSize: 13, color: color(r.media.status) }}>
          <b>media</b> — {r.media.status === 'none' ? 'nothing to purge' : `${r.media.purged} of ${r.media.found} purged${r.media.error ? ` (${r.media.error})` : ''}`}
        </div>
      )}
    </div>
  );

  return (
    <HubSubShell title="Erase an account" subtitle="Admin — a privacy@ request, carried out" loading={authLoading} backTo="/hub/profile">
      {(denied || (!authLoading && !isAdmin)) ? (
        <div style={{ textAlign: 'center', padding: 'var(--sp-10) var(--sp-6)' }}>
          <Icon name="shield" size={28} color="var(--tec-red)" />
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', marginTop: 8 }}>This page is for platform admins only.</div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: 'var(--tec-text-3)', marginBottom: 'var(--sp-4)', lineHeight: 1.5 }}>
            Removes the person&apos;s data from Life, TEC AI and Connection, and their Alert inbox and Insure risk profile. Messages they sent become &quot;deleted&quot;; a group they own passes to its oldest member. Payments, orders, balances and KYC stay — they are financial history.
          </div>
          <div style={card}>
            <label style={{ fontSize: 12, color: 'var(--tec-text-2)' }}>
              Pi username
              <input dir="ltr" value={name} onChange={(e) => { setName(e.target.value); setPlan(null); setDone(null); }} disabled={busy} style={input} />
            </label>
            <button type="button" onClick={() => { void dryRun(); }} disabled={busy || !name.trim()}
              style={{ marginTop: 10, padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--tec-surface-2)', color: 'var(--tec-gold)', border: '1px solid var(--tec-border)' }}>
              {busy && !plan ? 'Asking…' : 'Dry run'}
            </button>
          </div>
          {error && <div style={{ fontSize: 12, color: 'var(--tec-red)', marginBottom: 'var(--sp-3)' }}>{error}</div>}

          {plan && (
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tec-text-1)', marginBottom: 8 }} dir="ltr">{plan.username}</div>
              {parts(plan, 'would remove')}
              {!plan.complete && (
                <div style={{ fontSize: 12, color: 'var(--tec-gold)', marginTop: 8 }}>A part did not answer. You can still erase the rest and run it again later.</div>
              )}
              <label style={{ display: 'block', marginTop: 12, fontSize: 12, color: 'var(--tec-text-2)' }}>
                The request this answers (e.g. the privacy@ email&apos;s date and sender)
                <input value={ref} onChange={(e) => setRef(e.target.value)} disabled={busy} maxLength={200} style={input} />
              </label>
              <label style={{ display: 'block', marginTop: 12, fontSize: 12, color: 'var(--tec-text-2)' }}>
                Type <b dir="ltr">{plan.username}</b> to erase exactly this account
                <input dir="ltr" value={typed} onChange={(e) => setTyped(e.target.value)} disabled={busy} style={input} />
              </label>
              <button type="button" onClick={() => { void erase(); }} disabled={busy || typed !== plan.username || !ref.trim()}
                style={{ marginTop: 12, width: '100%', padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 700, background: 'var(--tec-red)', color: '#fff', border: 'none', opacity: busy || typed !== plan.username || !ref.trim() ? 0.4 : 1 }}>
                {busy ? 'Erasing…' : 'Erase — this cannot be undone'}
              </button>
            </div>
          )}

          {done && (
            <div role="status" style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, color: done.complete ? 'var(--tec-green)' : 'var(--tec-red)', marginBottom: 8 }}>
                {done.complete ? 'Erased in every service' : 'Not complete — run it again for the parts in red'}
              </div>
              {parts(done, 'removed')}
            </div>
          )}
        </div>
      )}
    </HubSubShell>
  );
}
