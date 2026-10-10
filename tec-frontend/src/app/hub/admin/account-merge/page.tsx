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
/** Each service merges the rows it owns; the page asks each one. */
const SERVICES = ['commerce', 'assets', 'kyc', 'notifications'] as const;
type Service = typeof SERVICES[number];
type PerService = Partial<Record<Service, Report | { error: string }>>;
const isReport = (r: Report | { error: string } | undefined): r is Report => !!r && 'moved' in r;

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
  const [plan, setPlan]       = useState<PerService | null>(null);
  const [done, setDone]       = useState<PerService | null>(null);
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

  const ask = async (service: Service, init?: RequestInit, username?: string): Promise<Report | { error: string }> => {
    try {
      const q = `service=${service}` + (username ? `&username=${encodeURIComponent(username)}` : '');
      const res = await fetch(`/api/admin/account-merge?${q}`, { credentials: 'include', cache: 'no-store', ...init });
      const data = await res.json().catch(() => ({}));
      return res.ok ? (data.data as Report) : { error: message(data, res.status) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  };

  const dryRun = async (username: string) => {
    setOpen(username); setPlan(null); setDone(null); setTyped(''); setBusy(true); setError(null);
    const out: PerService = {};
    for (const s of SERVICES) out[s] = await ask(s, undefined, username);
    setPlan(out);
    setBusy(false);
  };

  // Each service merges on its own, in order; one that fails does not undo the others —
  // each is its own transaction, and a re-run moves only what is still left.
  const merge = async () => {
    if (!plan || !open || typed !== open) return;
    setBusy(true); setError(null);
    const out: PerService = {};
    for (const s of SERVICES) {
      if (!isReport(plan[s])) continue;
      out[s] = await ask(s, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: open, confirm: typed }),
      });
    }
    setDone(out); setPlan(null); setTyped('');
    setBusy(false);
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
            Sign-in already lands on the oldest account. This moves what each service keeps under the others to it — commerce (products, orders, reviews, referrals, seller payouts, plans), assets (ownership, listings), kyc (the most advanced record) and notifications (inbox, devices, settings). Payment records are history and stay as they are.
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
                  {SERVICES.map((s) => {
                    const r = plan[s];
                    return (
                      <div key={s} style={{ fontSize: 13, color: 'var(--tec-text-1)' }}>
                        <b>{s}</b> — {isReport(r) ? `would move: ${moved(r)}` : <span style={{ color: 'var(--tec-red)' }}>{r?.error}</span>}
                        {isReport(r) && r.conflicts.length > 0 && (
                          <div style={{ fontSize: 12, color: 'var(--tec-gold)' }}>
                            {r.conflicts.length} left on a duplicate: {r.conflicts.map((c) => `${c.table} (${c.reason})`).join('; ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <label style={{ fontSize: 12, color: 'var(--tec-text-2)' }}>
                    Type <b dir="ltr">{g.username}</b> to merge exactly this
                    <input dir="ltr" value={typed} onChange={(e) => setTyped(e.target.value)} disabled={busy}
                      style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10, background: 'var(--tec-surface-2)', color: 'var(--tec-text-1)', border: '1px solid var(--tec-border)', fontSize: 15 }} />
                  </label>
                  <button type="button" onClick={() => { void merge(); }} disabled={busy || typed !== g.username || !SERVICES.some((s) => isReport(plan[s]))}
                    style={{ padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 700, background: 'var(--tec-gold)', color: '#000', border: 'none', opacity: busy || typed !== g.username ? 0.4 : 1 }}>
                    {busy ? 'Merging…' : 'Merge into the oldest'}
                  </button>
                </div>
              )}
              {open === g.username && done && (
                <div role="status" style={{ marginTop: 'var(--sp-3)', display: 'grid', gap: 4 }}>
                  {SERVICES.filter((s) => done[s]).map((s) => {
                    const r = done[s];
                    return (
                      <div key={s} style={{ fontSize: 12, color: isReport(r) ? 'var(--tec-green)' : 'var(--tec-red)' }}>
                        <b>{s}</b> — {isReport(r) ? `merged: ${moved(r)}${r.conflicts.length ? ` · ${r.conflicts.length} left for a person to decide` : ''}` : r?.error}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </HubSubShell>
  );
}
