'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePiAuth }   from '@/lib-client/hooks/usePiAuth';
import { HubSubShell } from '@/components/hub';
import { Icon }        from '@/components/ui/Icon';

/**
 * The payout queue.
 *
 * The platform cannot send Pi — a person does, from their own wallet — so this
 * screen is the working surface for that: who is waiting, where to send it, and
 * a place to record the transaction id afterwards.
 *
 * The address is shown large and monospaced with a copy button, because it is
 * copied by hand into a wallet app and a mis-copied character sends real Pi to
 * a stranger with no way back.
 *
 * "Mark sent" RECORDS a transfer that has already happened. It does not make
 * one — the platform holds no wallet and cannot move Pi. That is why the
 * transaction hash is required and why its shape is checked: the claimant is
 * told "Sent — π on its way, check your wallet" on the strength of this field,
 * and a field that accepts anything makes that sentence a guess.
 */

/** A Pi (Stellar) transaction hash: 32 bytes, written as 64 hex characters. */
const TX_HASH = /^[0-9a-fA-F]{64}$/;

type Status = 'CLAIMED' | 'PAID' | 'REJECTED';

interface Claim {
  id:             string;
  owner:          string;
  seat:           number | null;
  wallet_address: string;
  amount_pi:      string;
  status:         Status;
  tx_id:          string | null;
  note:           string | null;
  created_at:     string;
}

function Row({ claim, onDone }: { claim: Claim; onDone: () => void }) {
  const [txId,   setTxId]   = useState('');
  const [busy,   setBusy]   = useState(false);
  const [copied, setCopied] = useState(false);
  // Two taps, like Remove elsewhere: what this enables is paying twice.
  const [armedUnpaid, setArmedUnpaid] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const act = async (action: 'paid' | 'reject' | 'send' | 'unpaid') => {
    // 'send' needs no hash: the chain gives one back. The field is for
    // RECORDING a transfer somebody made by hand, which is still allowed.
    if (action === 'paid' && !TX_HASH.test(txId.trim())) {
      // The service refuses this too — it is the authority, and this copy only
      // saves a round trip. `1` used to pass both, and a claim went out saying
      // "Sent — 1 π on its way" while nothing had left any wallet.
      setError(
        txId.trim()
          ? 'That is not a transaction hash. Paste the 64-character hash from your wallet.'
          : 'Send the Pi first, then paste the transaction hash from your wallet.',
      );
      return;
    }
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/admin/campaign/claims', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          action === 'paid'
            ? { id: claim.id, action: 'paid', tx_id: txId.trim() }
            : action === 'send'
              ? { id: claim.id, action: 'send' }
              : action === 'unpaid'
                ? { id: claim.id, action: 'unpaid', note: 'Marked paid in error — no Pi was sent' }
                : { id: claim.id, action: 'reject', note: 'Rejected from the payout queue' },
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? data?.error ?? `Failed (${res.status})`);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(claim.wallet_address).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const tone = claim.status === 'PAID' ? 'var(--tec-green)'
    : claim.status === 'REJECTED' ? 'var(--tec-text-3)' : 'var(--tec-gold)';

  return (
    <div style={{
      background: 'var(--tec-surface)', border: '1px solid var(--tec-border)',
      borderRadius: 'var(--radius-md)', padding: 'var(--sp-4)', marginBottom: 'var(--sp-3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, color: tone }}>
          {claim.status}
        </span>
        <span dir="ltr" style={{ fontSize: 12, color: 'var(--tec-text-2)', fontWeight: 700 }}>
          #{claim.seat ?? '—'} · @{claim.owner}
        </span>
        <span style={{ flex: 1 }} />
        <span dir="ltr" style={{ fontSize: 13, fontWeight: 800, color: 'var(--tec-gold)' }}>
          {claim.amount_pi} π
        </span>
      </div>

      {/* Large, monospaced, and copyable. This string is retyped into a wallet
          app by a human; every character matters and none of them should be
          squinted at. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'var(--sp-3)' }}>
        <code dir="ltr" style={{
          flex: 1, minWidth: 0, fontSize: 12, lineHeight: 1.6,
          color: 'var(--tec-text-1)', fontFamily: 'var(--font-mono)',
          background: 'var(--tec-fill-soft)', border: '1px solid var(--tec-border)',
          borderRadius: 'var(--radius-sm)', padding: '8px 10px', overflowWrap: 'anywhere',
        }}>
          {claim.wallet_address}
        </code>
        <button onClick={copy} style={{
          flexShrink: 0, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
          background: copied ? 'rgba(34,197,94,0.1)' : 'var(--tec-fill-soft)',
          border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'var(--tec-border)'}`,
          color: copied ? 'var(--tec-green)' : 'var(--tec-text-2)',
          fontSize: 12, fontWeight: 700, cursor: 'pointer', font: 'inherit',
        }}>
          {copied ? '✓' : 'Copy'}
        </button>
      </div>

      {claim.status === 'CLAIMED' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 'var(--sp-3)', flexWrap: 'wrap' }}>
          <input
            value={txId}
            onChange={(e) => { setTxId(e.target.value); if (error) setError(null); }}
            placeholder="Transaction hash (64 characters)"
            dir="ltr"
            spellCheck={false}
            aria-label={`Transaction id for seat ${claim.seat ?? ''}`}
            style={{
              flex: 1, minWidth: 160, background: 'var(--tec-fill-soft)',
              border: '1px solid var(--tec-border)', borderRadius: 'var(--radius-sm)',
              padding: '8px 10px', color: 'var(--tec-text-1)', fontSize: 12,
              fontFamily: 'var(--font-mono)', outline: 'none',
            }}
          />
          {/* The one button that MOVES Pi. First, and gold, because it is the
              normal path now — "Mark sent" beside it is for a transfer made by
              hand, which is still allowed and is no longer the only way. */}
          <button onClick={() => { void act('send'); }} disabled={busy} style={{
            padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'linear-gradient(135deg,var(--tec-gold),#E8962A)',
            color: '#1a1200', fontWeight: 800, fontSize: 12,
            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, font: 'inherit',
          }}>
            {busy ? 'Sending…' : `Send ${claim.amount_pi} π now`}
          </button>
          <button onClick={() => { void act('paid'); }} disabled={busy} style={{
            padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'linear-gradient(135deg,var(--tec-green),#16A34A)',
            color: '#05130a', fontWeight: 800, fontSize: 12,
            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, font: 'inherit',
          }}>
            Mark sent
          </button>
          {/* Which button does what, said once. They sit next to each other and
              only one of them moves money — a person who mistakes the second
              for the first records a payment that never happened and tells the
              claimant to go and look for it. */}
          <p style={{
            width: '100%', margin: '2px 0 0', fontSize: 11, lineHeight: 1.5,
            color: 'var(--tec-text-3)',
          }}>
            <strong>Send now</strong> transfers the Pi from the payout wallet and records the real
            transaction. <strong>Mark sent</strong> only records one you already sent by hand — paste
            its hash first.
          </p>
          <button onClick={() => { void act('reject'); }} disabled={busy} style={{
            padding: '8px 14px', borderRadius: 'var(--radius-sm)',
            background: 'transparent', border: '1px solid rgba(239,68,68,0.4)',
            color: 'var(--tec-red)', fontWeight: 700, fontSize: 12,
            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, font: 'inherit',
          }}>
            Reject
          </button>
        </div>
      )}

      {/* Putting a wrongly-paid claim back in the queue.
          The mistake this undoes actually happened: a claim was marked PAID
          with a transaction id of `1`. Without this the only remedy is editing
          the row by hand — Forbidden Behavior #1 and #10 — so the governed
          path is what stops the rule being broken, not a loosening of it.

          TWO taps, and the label changes to say what the second one does. It is
          the most dangerous control on this screen, because what it enables is
          paying twice. */}
      {claim.status === 'PAID' && (
        <div style={{ marginTop: 'var(--sp-3)' }}>
          <button
            onClick={() => {
              if (!armedUnpaid) { setArmedUnpaid(true); return; }
              setArmedUnpaid(false);
              void act('unpaid');
            }}
            disabled={busy}
            style={{
              padding: armedUnpaid ? '8px 14px' : '4px 0', borderRadius: 'var(--radius-sm)',
              background: armedUnpaid ? 'rgba(239,68,68,0.1)' : 'transparent',
              border: armedUnpaid ? '1px solid rgba(239,68,68,0.4)' : 'none',
              color: 'var(--tec-red)', fontWeight: 700, fontSize: 12,
              cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, font: 'inherit',
            }}
          >
            {armedUnpaid
              ? 'Confirm — put it back in the queue'
              : 'Not actually paid? Put it back in the queue'}
          </button>
          {armedUnpaid && (
            <p style={{ margin: '6px 0 0', fontSize: 11, lineHeight: 1.5, color: 'var(--tec-text-3)' }}>
              This does not claw anything back. If the Pi really did move, the record will
              stop matching the chain — and the next payout will send it again.
            </p>
          )}
        </div>
      )}

      {claim.tx_id && (
        <div dir="ltr" style={{ marginTop: 8, fontSize: 11, color: 'var(--tec-text-3)', fontFamily: 'var(--font-mono)', overflowWrap: 'anywhere' }}>
          tx: {claim.tx_id}
        </div>
      )}
      {claim.note && (
        <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--tec-text-3)' }}>{claim.note}</div>
      )}
      {error && (
        <div role="alert" style={{ marginTop: 8, fontSize: 12, color: 'var(--tec-red)' }}>{error}</div>
      )}
    </div>
  );
}

export default function AdminCampaignPage() {
  const { user, isLoading: authLoading } = usePiAuth();
  const isAdmin = (user as { role?: string } | null)?.role === 'admin';

  const [claims,  setClaims]  = useState<Claim[]>([]);
  const [filter,  setFilter]  = useState<Status | 'ALL'>('CLAIMED');
  const [loading, setLoading] = useState(true);
  const [denied,  setDenied]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  // Whether this platform can actually send Pi at all.
  //
  // Setting the payout wallet up is the one part of this path done by hand, in
  // a dashboard, from a value that cannot be read back. Without saying so here,
  // the only way to learn it has a typo in it is to attempt a real payout and
  // read the failure.
  const [wallet, setWallet] = useState<{
    configured: boolean; wallet: string | null; max_pi: number | null; problem: string | null;
  } | null>(null);

  const load = useCallback(async (status: Status | 'ALL') => {
    setLoading(true); setError(null);
    try {
      const qs  = status === 'ALL' ? '' : `?status=${status}`;
      const res = await fetch(`/api/admin/campaign/claims${qs}`, { credentials: 'include' });
      if (res.status === 401 || res.status === 403) { setDenied(true); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `Failed (${res.status})`);
      setClaims(data?.data?.claims ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!authLoading) void load(filter); }, [authLoading, filter, load]);

  useEffect(() => {
    if (authLoading) return;
    fetch('/api/admin/campaign/payout-wallet', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setWallet(j?.data ?? null))
      // Silent on purpose: this is a status line, not the page. A banner that
      // failed to load must not become the thing that looks broken.
      .catch(() => {});
  }, [authLoading]);

  const owed = claims.filter((c) => c.status === 'CLAIMED')
    .reduce((n, c) => n + Number(c.amount_pi || 0), 0);

  return (
    <HubSubShell
      title="Campaign payouts"
      subtitle="Admin — who is waiting for Pi"
      loading={authLoading || loading}
    >
      {(denied || (!authLoading && !isAdmin)) ? (
        <div style={{ textAlign: 'center', padding: 'var(--sp-10) var(--sp-6)' }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16, margin: '0 auto var(--sp-4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          }}>
            <Icon name="shield" size={28} color="var(--tec-red)" />
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--tec-text-1)', marginBottom: 6 }}>
            Access restricted
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)' }}>
            This page is for platform admins only.
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--sp-4)', flexWrap: 'wrap' }}>
            {(['CLAIMED', 'PAID', 'REJECTED', 'ALL'] as const).map((s) => (
              <button key={s} onClick={() => setFilter(s)} style={{
                fontSize: 11.5, fontWeight: 700, padding: '6px 12px', borderRadius: 999,
                cursor: 'pointer', font: 'inherit',
                background: filter === s ? 'var(--tec-fill-soft)' : 'transparent',
                border: `1px solid ${filter === s ? 'var(--tec-border-gold)' : 'var(--tec-border)'}`,
                color: filter === s ? 'var(--tec-gold)' : 'var(--tec-text-3)',
              }}>
                {s === 'CLAIMED' ? 'To pay' : s}
              </button>
            ))}
          </div>

          {/* The state of the payout wallet, before anything that spends it.
              Green with the public key so it can be compared against the wallet
              that was actually funded; amber with the service's own diagnosis
              when something is wrong — "a passphrase with a mistyped word" is
              a sentence somebody can act on, and it is the one they would
              otherwise have had to provoke by attempting a real payout. */}
          {wallet && (
            <div dir="ltr" style={{
              padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-3)',
              borderRadius: 'var(--radius-md)', fontSize: 12,
              background: wallet.configured ? 'rgba(34,197,94,0.07)' : 'rgba(251,180,74,0.07)',
              border: `1px solid ${wallet.configured ? 'rgba(34,197,94,0.25)' : 'var(--tec-border-gold)'}`,
              color: wallet.configured ? 'var(--tec-green)' : 'var(--tec-gold)',
            }}>
              {wallet.configured ? (
                <>
                  <strong>Payout wallet ready</strong>
                  {wallet.max_pi !== null && <> · up to {wallet.max_pi} π per payout</>}
                  <div style={{
                    marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 11,
                    color: 'var(--tec-text-3)', overflowWrap: 'anywhere',
                  }}>
                    {wallet.wallet}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--tec-text-3)' }}>
                    Check this is the wallet you funded — it is where every payout comes from.
                  </div>
                </>
              ) : (
                <>
                  <strong>No payout wallet — “Send now” cannot send anything</strong>
                  <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--tec-text-3)', lineHeight: 1.5 }}>
                    {wallet.problem
                      ?? 'Set PI_A2U_WALLET_SEED on payment-service to the app wallet’s secret key or its 24-word passphrase, and put Pi in that wallet.'}
                  </div>
                </>
              )}
            </div>
          )}

          {filter === 'CLAIMED' && claims.length > 0 && (
            <div dir="ltr" style={{
              padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-3)',
              background: 'var(--tec-fill-softer)', border: '1px solid var(--tec-border)',
              borderRadius: 'var(--radius-md)', fontSize: 12.5, color: 'var(--tec-text-2)',
            }}>
              {claims.length} waiting · {owed} π to send
            </div>
          )}

          {error ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: 'var(--sp-4)',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 'var(--radius-md)', color: 'var(--tec-red)', fontSize: 'var(--text-sm)',
            }}>
              <Icon name="alert" size={16} color="var(--tec-red)" /> {error}
            </div>
          ) : claims.length === 0 && !loading ? (
            <div style={{ textAlign: 'center', padding: 'var(--sp-10) var(--sp-6)', color: 'var(--tec-text-3)', fontSize: 'var(--text-sm)' }}>
              {filter === 'CLAIMED' ? 'Nobody is waiting for a payout.' : 'Nothing here.'}
            </div>
          ) : (
            claims.map((c) => <Row key={c.id} claim={c} onDone={() => void load(filter)} />)
          )}
        </>
      )}
    </HubSubShell>
  );
}
