'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePiAuth }   from '@/lib-client/hooks/usePiAuth';
import { HubSubShell } from '@/components/hub';
import { Icon }        from '@/components/ui/Icon';

/**
 * Merge a Pioneer's duplicate accounts into the oldest (tec-core-backend #403).
 *
 * The list comes from auth-service. Per name, the dry run is shown first and changes
 * nothing; the merge needs the name typed again. Anything that cannot move without a
 * person choosing (a second plan, a second Pro in the same app) is listed as a
 * conflict and stays where it is. `role === 'admin'` here is a courtesy; the services
 * enforce it on the signed token.
 */

interface Group { username: string; canonical: string; duplicates: string[] }
interface Conflict { table: string; id: string; reason: string }
interface Report { group: Group; moved: Record<string, number>; conflicts: Conflict[] }

const message = (data: unknown, status: number) =>
  (data as { message?: string; error?: string })?.message ?? (data as { error?: string })?.error ?? `Failed (${status})`;

export default function AccountMergePage() {
  const { user, isLoading: authLoading } = usePiAuth();
  const isAdmin = (user as { role?: string } | null)?.role === 'admin';
  const [groups, setGroups]   = useState<Group[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [open, setOpen]       = useState<string | null>(null);
  const [plan, setPlan]       = useState<Report | null>(null);
  const [done, setDone]       = useState<Report | null>(null);
  const [typed, setTyped]     = useState('');
  const [busy, setBusy]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/admin/duplicate-accounts', { credentials: 'include', cache: 'no-store' });
      if (res.status === 401 || res.status === 403) { setDenied(true); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(message(data, res.status));
      setGroups((data?.data?.groups ?? []) as Group[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!authLoading) void load(); }, [authLoading, load]);

  const dryRun = async (username: string) => {
    setOpen(username); setPlan(null); setDone(null); setTyped(''); setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/admin/account-merge?username=${encodeURIComponent(username)}`, { credentials: 'include', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(message(data, res.status));
      setPlan(data.data as Report);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const merge = async () => {
    if (!plan || typed !== plan.group.username) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/admin/account-merge', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: plan.group.username, confirm: typed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(message(data, res.status));
      setDone(data.data as Report);
      setPlan(null); setTyped('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const moved = (r: Report) => Object.entries(r.moved).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(' · ') || 'nothing to move';
  const card = { background: 'var(--tec-surface)', border: '1px solid var(--tec-border)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-4)', marginBottom: 'var(--sp-3)' } as const;
  const mono = { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--tec-text-3)', overflowWrap: 'anywhere' } as const;

  return (
    <HubSubShell title="Duplicate accounts" subtitle="Admin — one Pioneer, one account" loading={authLoading || loading} backTo="/hub/profile">
      {(denied || (!authLoading && !isAdmin)) ? (
        <div style={{ textAlign: 'center', padding: 'var(--sp-10) var(--sp-6)' }}>
          <Icon name="shield" size={28} color="var(--tec-red)" />
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', marginTop: 8 }}>This page is for platform admins only.</div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: 'var(--tec-text-3)', marginBottom: 'var(--sp-4)', lineHeight: 1.5 }}>
            Sign-in already lands on the oldest account. This moves what commerce keeps under the others — products, orders, reviews, referrals, seller payouts — to it. Payment records are history and stay as they are.
          </div>
          {error && <div style={{ fontSize: 12, color: 'var(--tec-red)', marginBottom: 'var(--sp-3)' }}>{error}</div>}
          {groups && groups.length === 0 && <div style={{ fontSize: 13, color: 'var(--tec-green)' }}>No Pioneer has more than one account.</div>}
          {groups?.map((g) => (
            <div key={g.username} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--tec-text-1)' }} dir="ltr">
                  {g.username} <span style={{ fontWeight: 400, color: 'var(--tec-text-3)' }}>· {g.duplicates.length + 1} accounts</span>
                </div>
                <button type="button" onClick={() => { void dryRun(g.username); }} disabled={busy}
                  style={{ padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: 'var(--tec-surface-2)', color: 'var(--tec-gold)', border: '1px solid var(--tec-border)' }}>
                  Dry run
                </button>
              </div>
              <div dir="ltr" style={mono}>oldest {g.canonical}</div>

              {open === g.username && plan && (
                <div style={{ marginTop: 'var(--sp-3)', display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 13, color: 'var(--tec-text-1)' }}>Would move: {moved(plan)}</div>
                  {plan.conflicts.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--tec-gold)' }}>
                      {plan.conflicts.length} left on a duplicate: {plan.conflicts.map((c) => `${c.table} (${c.reason})`).join('; ')}
                    </div>
                  )}
                  <label style={{ fontSize: 12, color: 'var(--tec-text-2)' }}>
                    Type <b dir="ltr">{plan.group.username}</b> to merge exactly this
                    <input dir="ltr" value={typed} onChange={(e) => setTyped(e.target.value)} disabled={busy}
                      style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10, background: 'var(--tec-surface-2)', color: 'var(--tec-text-1)', border: '1px solid var(--tec-border)', fontSize: 15 }} />
                  </label>
                  <button type="button" onClick={() => { void merge(); }} disabled={busy || typed !== plan.group.username}
                    style={{ padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 700, background: 'var(--tec-gold)', color: '#000', border: 'none', opacity: busy || typed !== plan.group.username ? 0.4 : 1 }}>
                    {busy ? 'Merging…' : 'Merge into the oldest'}
                  </button>
                </div>
              )}
              {open === g.username && done && (
                <div role="status" style={{ marginTop: 'var(--sp-3)', fontSize: 12, color: 'var(--tec-green)' }}>
                  Merged: {moved(done)}{done.conflicts.length ? ` · ${done.conflicts.length} left for a person to decide` : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </HubSubShell>
  );
}
