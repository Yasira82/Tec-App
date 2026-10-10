'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePiAuth }   from '@/lib-client/hooks/usePiAuth';
import { HubSubShell } from '@/components/hub';
import { Icon }        from '@/components/ui/Icon';

/**
 * Which payments moved real π — asked of the chain, not of the database.
 *
 * The Test-Pi marker on a payment only exists since 2026-09; before it, a Test-Pi
 * payment looked exactly like a Mainnet one (owner, 2026-10-10: magy888 has no
 * Mainnet wallet, yet his April payments were credited as real π). Each payer's
 * payments are looked up on Mainnet's chain, then Testnet's, a page at a time.
 * READ-ONLY. `role === 'admin'` here is a courtesy; payment-service enforces it.
 */

import { accumulate, short, zero, type Network, type Payer, type Page, type Result } from '@/lib/admin/payment-networks';

const PAGE = 50;
const LABEL: Record<Network, { text: string; color: string }> = {
  mainnet:   { text: 'Mainnet (real π)',          color: 'var(--tec-green)' },
  testnet:   { text: 'Testnet (Test-Pi)',         color: 'var(--tec-gold)' },
  not_found: { text: 'On neither chain',          color: 'var(--tec-red)' },
  unknown:   { text: 'Chain did not answer',      color: 'var(--tec-text-3)' },
};

function PayerRow({ payer }: { payer: Payer }) {
  const [result, setResult] = useState<Result | undefined>();
  const [running, setRunning] = useState(false);

  const check = async () => {
    setRunning(true);
    let offset = 0;
    let acc: Result | undefined;
    try {
      for (;;) {
        const res  = await fetch(`/api/admin/payment-networks?userId=${encodeURIComponent(payer.user_id)}&offset=${offset}&limit=${PAGE}`, { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error?.message ?? `Failed (${res.status})`);
        acc = accumulate(acc, data.data as Page, offset);
        setResult(acc);
        if (acc.done || (data.data as Page).checked === 0) break;
        offset = acc.checked;
      }
    } catch (e) {
      setResult((r) => ({ ...(r ?? { checked: 0, total: 0, done: false, sums: zero(), odd: [], routes: [] }), error: (e as Error).message }));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ background: 'var(--tec-surface)', border: '1px solid var(--tec-border)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-4)', marginBottom: 'var(--sp-3)' }}>
      <div dir="ltr" style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--tec-text-1)', overflowWrap: 'anywhere' }}>{payer.user_id}</div>
      <div style={{ fontSize: 11, color: 'var(--tec-text-3)', marginTop: 4 }}>
        {payer.payments.count} payments · {payer.payments.amount} π · marked Test-Pi {payer.marked_testnet.count} ({payer.marked_testnet.amount} π) · no txid {payer.no_txid.count}
      </div>
      {result && (
        <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
          {(Object.keys(LABEL) as Network[]).filter((k) => result.sums[k].count > 0).map((k) => (
            <div key={k} style={{ fontSize: 12, color: LABEL[k].color }}>
              {LABEL[k].text}: {result.sums[k].count} · {result.sums[k].amount} π
            </div>
          ))}
          {result.routes.length > 0 && (
            <div style={{ marginTop: 4, display: 'grid', gap: 2 }}>
              <div style={{ fontSize: 11, color: 'var(--tec-text-2)', fontWeight: 700 }}>Sender → receiver (from the chain)</div>
              {result.routes.map((r) => (
                <div key={`${r.network}|${r.from}|${r.to}`} dir="ltr" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: LABEL[r.network].color }}>
                  {short(r.from)} → {short(r.to)}{r.from && r.from === r.to ? ' (same wallet)' : ''} · {r.count} · {r.amount} π
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--tec-text-3)' }}>
            {result.done ? 'Checked all' : `Checked ${result.checked} of ${result.total}`}{result.odd.length ? ` · ${result.odd.length} marked Test-Pi but on Mainnet` : ''}
          </div>
          {result.error && <div style={{ fontSize: 11, color: 'var(--tec-red)' }}>{result.error}</div>}
        </div>
      )}
      <button type="button" onClick={() => { void check(); }} disabled={running}
        style={{ marginTop: 10, fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 'var(--radius-sm)', background: 'transparent', border: '1px solid var(--tec-border-gold)', color: 'var(--tec-gold)', opacity: running ? 0.5 : 1, cursor: running ? 'default' : 'pointer' }}>
        {running ? 'Checking the chain…' : result ? 'Check again' : 'Check on the chain'}
      </button>
    </div>
  );
}

export default function PaymentNetworksPage() {
  const { user, isLoading: authLoading } = usePiAuth();
  const isAdmin = (user as { role?: string } | null)?.role === 'admin';
  const [payers, setPayers]   = useState<Payer[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/admin/payment-networks', { credentials: 'include' });
      if (res.status === 401 || res.status === 403) { setDenied(true); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? `Failed (${res.status})`);
      setPayers(data?.data?.payers ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!authLoading) void load(); }, [authLoading, load]);

  return (
    <HubSubShell title="Payment networks" subtitle="Admin — which payments moved real π" loading={authLoading || loading} backTo="/hub/profile">
      {(denied || (!authLoading && !isAdmin)) ? (
        <div style={{ textAlign: 'center', padding: 'var(--sp-10) var(--sp-6)' }}>
          <Icon name="shield" size={28} color="var(--tec-red)" />
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', marginTop: 8 }}>This page is for platform admins only.</div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: 'var(--tec-text-3)', marginBottom: 'var(--sp-4)', lineHeight: 1.5 }}>
            Read-only. Each payment&apos;s transaction is looked up on Mainnet, then Testnet — which network, and which wallet sent and received it. Nothing is changed.
          </div>
          {error && <div style={{ fontSize: 12, color: 'var(--tec-red)', marginBottom: 'var(--sp-3)' }}>{error}</div>}
          {payers.map((p) => <PayerRow key={p.user_id} payer={p} />)}
        </div>
      )}
    </HubSubShell>
  );
}
