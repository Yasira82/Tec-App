'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePiAuth }   from '@/lib-client/hooks/usePiAuth';
import { HubSubShell } from '@/components/hub';
import { Icon }        from '@/components/ui/Icon';
import { appsHeld, owed, shortfall, type Liabilities } from '@/lib/admin/seller-liabilities';

/**
 * Owed to sellers (tec-core-backend #409). Sellers withdraw from the Hub's app wallet
 * only; sales land elsewhere. This page says how much is owed, what the Hub wallet
 * holds on the chain, and the difference to move in by hand. READ-ONLY.
 * `role === 'admin'` here is a courtesy; every service enforces it on the token.
 */

const fmt = (v: number | string | null | undefined) => (v == null ? '—' : `${Number(v).toLocaleString('en-US', { maximumFractionDigits: 7 })} π`);

export default function SellerLiabilitiesPage() {
  const { user, isLoading: authLoading } = usePiAuth();
  const isAdmin = (user as { role?: string } | null)?.role === 'admin';
  const [data, setData]       = useState<Liabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/admin/seller-liabilities', { credentials: 'include', cache: 'no-store' });
      if (res.status === 401 || res.status === 403) { setDenied(true); return; }
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setData((await res.json()) as Liabilities);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!authLoading) void load(); }, [authLoading, load]);

  const card = { background: 'var(--tec-surface)', border: '1px solid var(--tec-border)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-4)', marginBottom: 'var(--sp-3)' } as const;
  const row = (label: string, value: string, note?: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, color: 'var(--tec-text-1)', padding: '4px 0' }}>
      <span>{label}{note && <span style={{ display: 'block', fontSize: 11, color: 'var(--tec-text-3)' }}>{note}</span>}</span>
      <b dir="ltr" style={{ whiteSpace: 'nowrap' }}>{value}</b>
    </div>
  );

  const pi = data?.wallet?.balances.find((b) => b.currency === 'PI');
  const total = data ? owed(data) : null;
  const gap   = data ? shortfall(data) : null;

  return (
    <HubSubShell title="Owed to sellers" subtitle="Admin — what sellers can withdraw vs. the Hub wallet" loading={authLoading || loading} backTo="/hub/profile">
      {(denied || (!authLoading && !isAdmin)) ? (
        <div style={{ textAlign: 'center', padding: 'var(--sp-10) var(--sp-6)' }}>
          <Icon name="shield" size={28} color="var(--tec-red)" />
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', marginTop: 8 }}>This page is for platform admins only.</div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: 'var(--tec-text-3)', marginBottom: 'var(--sp-4)', lineHeight: 1.5 }}>
            Read-only. Withdrawals to Pi Network are sent from the Hub&apos;s app wallet only; sales land in other wallets. Move the difference into the Hub wallet by hand.
          </div>
          {error && <div style={{ fontSize: 12, color: 'var(--tec-red)', marginBottom: 'var(--sp-3)' }}>{error}</div>}
          {data && (
            <>
              <div style={card}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tec-text-2)', marginBottom: 4 }}>Owed</div>
                {data.wallet
                  ? row('TEC balances (π)', fmt(pi?.amount ?? '0'), `${pi?.wallets ?? 0} wallet(s) — sellers' shares`)
                  : row('TEC balances (π)', 'could not be read')}
                {data.wallet && row('Withdrawals not yet sent', fmt(data.wallet.withdrawals_pending.amount), `${data.wallet.withdrawals_pending.count} pending`)}
                {data.payouts
                  ? row('Sales not yet credited (OWED)', fmt(data.payouts.OWED?.amount ?? '0'), `${data.payouts.OWED?.count ?? 0} payout(s) — credited when SELLER_BALANCE_CREDIT is on`)
                  : row('Sales not yet credited (OWED)', 'could not be read')}
                <div style={{ borderTop: '1px solid var(--tec-border)', marginTop: 6, paddingTop: 6 }}>
                  {row('Total owed', total == null ? 'incomplete' : fmt(total))}
                </div>
              </div>

              <div style={card}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tec-text-2)', marginBottom: 4 }}>Hub app wallet (Mainnet)</div>
                {!data.hub || !data.hub.address
                  ? <div style={{ fontSize: 12, color: 'var(--tec-text-3)' }}>No address configured — set PI_HUB_APP_WALLET_ADDRESS (public) or the seed on payment-service.</div>
                  : (
                    <>
                      <div dir="ltr" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--tec-text-3)', overflowWrap: 'anywhere' }}>{data.hub.address}</div>
                      {row('Balance on the chain',
                        data.hub.exists === false ? 'not on the chain yet' : data.hub.balance == null ? 'chain did not answer' : fmt(data.hub.balance),
                        data.hub.source === 'seed' ? 'the payout wallet (seed set)' : 'read from its public address — the seed is not set yet')}
                    </>
                  )}
              </div>

              {(data.hub?.apps?.length ?? 0) > 0 && (
                <div style={card}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tec-text-2)', marginBottom: 4 }}>Other app wallets (Mainnet) — where sales land</div>
                  {data.hub!.apps!.map((a) => (
                    <div key={a.app} style={{ marginBottom: 6 }}>
                      {row(a.app,
                        a.problem ? a.problem : a.exists === false ? 'not on the chain yet' : a.balance == null ? 'chain did not answer' : fmt(a.balance))}
                      {a.address && <div dir="ltr" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--tec-text-3)', overflowWrap: 'anywhere' }}>{a.address}</div>}
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid var(--tec-border)', marginTop: 6, paddingTop: 6 }}>
                    {row('Held in app wallets', fmt(appsHeld(data)), 'π you can move into the Hub wallet')}
                  </div>
                </div>
              )}

              <div style={{ ...card, borderColor: gap ? 'var(--tec-gold)' : 'var(--tec-border)' }}>
                {row('To move into the Hub wallet', gap == null ? 'unknown' : fmt(gap))}
                <div style={{ fontSize: 11, color: 'var(--tec-text-3)', marginTop: 4 }}>
                  The chain also keeps a minimum reserve in every wallet, which cannot be sent — keep a little above this number.
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </HubSubShell>
  );
}
