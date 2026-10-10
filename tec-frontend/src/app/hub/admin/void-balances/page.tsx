'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePiAuth }   from '@/lib-client/hooks/usePiAuth';
import { HubSubShell } from '@/components/hub';
import { Icon }        from '@/components/ui/Icon';

/**
 * Reverse TEC balances with no sale behind them (tec-core-backend #402).
 *
 * The dry run is what the page shows first, and it changes nothing. The run itself
 * needs the dry run's exact total and the typed phrase, and the service re-checks
 * every wallet against what the dry run saw. `role === 'admin'` here is a courtesy;
 * wallet-service enforces it on the signed token.
 */

interface Breakdown { purchase_echoes: string; deposits: string; transfers_in: string; transfers_out: string; sales: string; withdrawn: string; unrecorded: string }
interface Item { walletId: string; userId: string; currency: string; balance: string; keep: string; void: string; breakdown: Breakdown }
interface Plan { wallets: number; total: string; items: Item[]; confirm: string }
interface RunResult { applied: { walletId: string; voided: string }[]; skipped: { walletId: string; reason: string }[] }

export default function VoidBalancesPage() {
  const { user, isLoading: authLoading } = usePiAuth();
  const isAdmin = (user as { role?: string } | null)?.role === 'admin';
  const [plan, setPlan]       = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [typed, setTyped]     = useState('');
  const [busy, setBusy]       = useState(false);
  const [result, setResult]   = useState<RunResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/admin/void-balances', { credentials: 'include', cache: 'no-store' });
      if (res.status === 401 || res.status === 403) { setDenied(true); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? `Failed (${res.status})`);
      setPlan(data as Plan);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!authLoading) void load(); }, [authLoading, load]);

  const run = async () => {
    if (!plan || typed !== plan.confirm) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/admin/void-balances', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: crypto.randomUUID(), expectedTotal: plan.total, confirm: typed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? `Failed (${res.status})`);
      setResult(data as RunResult);
      setTyped('');
      void load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const line = (label: string, v: string) => (Number(v) !== 0 ? <span style={{ marginInlineEnd: 10 }}>{label} {v}</span> : null);

  return (
    <HubSubShell title="Unbacked balances" subtitle="Admin — reverse TEC balances with no sale behind them" loading={authLoading || loading} backTo="/hub/profile">
      {(denied || (!authLoading && !isAdmin)) ? (
        <div style={{ textAlign: 'center', padding: 'var(--sp-10) var(--sp-6)' }}>
          <Icon name="shield" size={28} color="var(--tec-red)" />
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', marginTop: 8 }}>This page is for platform admins only.</div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: 'var(--tec-text-3)', marginBottom: 'var(--sp-4)', lineHeight: 1.5 }}>
            Dry run — nothing has changed. Only a sale backs a TEC balance; everything else below is reversed with its own ledger and audit row. The π itself stays where it is (the apps&apos; Pi wallets).
          </div>
          {error && <div style={{ fontSize: 12, color: 'var(--tec-red)', marginBottom: 'var(--sp-3)' }}>{error}</div>}
          {result && (
            <div role="status" style={{ fontSize: 12, color: 'var(--tec-green)', marginBottom: 'var(--sp-3)' }}>
              Reversed {result.applied.length} wallet(s){result.skipped.length ? ` · skipped ${result.skipped.length}: ${result.skipped.map((s) => s.reason).join('; ')}` : ''}
            </div>
          )}
          {plan && (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tec-text-1)', marginBottom: 'var(--sp-3)' }}>
                {plan.wallets} wallet(s) · {plan.total} to reverse
              </div>
              {plan.items.map((i) => (
                <div key={i.walletId} style={{ background: 'var(--tec-surface)', border: '1px solid var(--tec-border)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-4)', marginBottom: 'var(--sp-3)' }}>
                  <div dir="ltr" style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--tec-text-1)', overflowWrap: 'anywhere' }}>{i.userId}</div>
                  <div style={{ fontSize: 13, marginTop: 4, color: 'var(--tec-text-1)' }}>
                    {i.balance} {i.currency} → <b style={{ color: 'var(--tec-gold)' }}>{i.keep}</b> (reverse {i.void})
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--tec-text-3)', marginTop: 4, lineHeight: 1.6 }}>
                    {line('purchase echoes', i.breakdown.purchase_echoes)}{line('deposits', i.breakdown.deposits)}{line('in', i.breakdown.transfers_in)}{line('out', i.breakdown.transfers_out)}{line('sales', i.breakdown.sales)}{line('withdrawn', i.breakdown.withdrawn)}{line('no ledger row', i.breakdown.unrecorded)}
                  </div>
                </div>
              ))}
              {plan.wallets > 0 && (
                <div style={{ marginTop: 'var(--sp-4)', display: 'grid', gap: 8 }}>
                  <label style={{ fontSize: 12, color: 'var(--tec-text-2)' }}>
                    Type <b dir="ltr">{plan.confirm}</b> to reverse exactly these balances
                    <input dir="ltr" value={typed} onChange={(e) => setTyped(e.target.value)} disabled={busy}
                      style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10, background: 'var(--tec-surface-2)', color: 'var(--tec-text-1)', border: '1px solid var(--tec-border)', fontSize: 15 }} />
                  </label>
                  <button type="button" onClick={() => { void run(); }} disabled={busy || typed !== plan.confirm}
                    style={{ padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 700, background: 'var(--tec-red)', color: '#fff', border: 'none', opacity: busy || typed !== plan.confirm ? 0.4 : 1 }}>
                    {busy ? 'Reversing…' : `Reverse ${plan.total}`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </HubSubShell>
  );
}
