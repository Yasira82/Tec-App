'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter }  from 'next/navigation';
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
  /**
   * Why this reward is owed, frozen by the service when the seat was taken.
   *
   * Null on any claim made before the column existed — and the card says so
   * rather than rendering "0 of 0", which would read as "did nothing".
   */
  qualified:      { at: string; required: string[]; done: { app: string; at: string | null }[] } | null;
}

/** `2026-09-19T03:25:44Z` → `19 Sep`. A tick with no date could mean anything. */
const shortDate = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/**
 * What this pioneer actually did, before anybody sends them real Pi.
 *
 * The service already refuses an unqualified claim — this cannot be the check,
 * and is not pretending to be. It is the EVIDENCE of a check that already
 * happened, on the screen where somebody decides to move money, because "the
 * service verified it" and "I can see what it verified" stop being the same
 * sentence somewhere around the fiftieth claim.
 *
 * Collapsed by default: the count is the answer nearly every time, and a
 * payout queue that makes you scroll past 24 app names per row is a queue
 * people stop reading.
 */
function Qualification({ q }: { q: Claim['qualified'] }) {
  const [open, setOpen] = useState(false);

  if (!q) {
    // No invented evidence. A claim from before this was recorded gets a
    // sentence saying exactly that, which is worth more than a reassuring
    // number nothing stands behind.
    return (
      <div style={{ marginTop: 'var(--sp-3)', fontSize: 11.5, color: 'var(--tec-text-3)' }}>
        Claimed before missions were recorded — no detail on file.
      </div>
    );
  }

  const complete = q.done.length >= q.required.length;

  return (
    <div style={{ marginTop: 'var(--sp-3)' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', padding: 0,
          color: complete ? 'var(--tec-green)' : 'var(--tec-text-3)',
          fontSize: 12, fontWeight: 700, cursor: 'pointer', font: 'inherit',
        }}
      >
        <span>{complete ? '✓' : '•'}</span>
        <span dir="ltr">{q.done.length} / {q.required.length} missions</span>
        <span style={{ color: 'var(--tec-text-3)', fontWeight: 600 }}>· {shortDate(q.at)}</span>
        <span style={{ color: 'var(--tec-text-3)' }}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {q.done.map(({ app, at }) => (
            <span key={app} dir="ltr" style={{
              fontSize: 11, color: 'var(--tec-text-2)',
              background: 'var(--tec-fill-soft)', border: '1px solid var(--tec-border)',
              borderRadius: 'var(--radius-sm)', padding: '4px 8px',
            }}>
              {app}{at ? ` · ${shortDate(at)}` : ''}
            </span>
          ))}
          {/* The list this claim was measured against, said plainly. It is NOT
              today's CAMPAIGN_APPS, and it must not be read as such: a later
              round asking for more cannot make this reward less earned. */}
          <span style={{ width: '100%', fontSize: 11, color: 'var(--tec-text-3)', marginTop: 4, lineHeight: 1.6 }}>
            Measured against the {q.required.length} apps this round asked for, not today&rsquo;s list.
          </span>
        </div>
      )}
    </div>
  );
}

function Row({ claim, onDone, canSend }: {
  claim: Claim; onDone: () => void;
  /**
   * Whether payment-service actually has a payout wallet.
   *
   * A control the system cannot honour is worse than no control: it fails on
   * the tap, and the failure looks like the platform being broken rather than
   * a wallet not being set up. So when there is none, "Send now" is disabled
   * and says why, and the hand-sent path becomes the primary one again — which
   * it legitimately is until an app wallet exists.
   */
  canSend: boolean;
}) {
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

      <Qualification q={claim.qualified} />

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
          <button
            onClick={() => { void act('send'); }}
            disabled={busy || !canSend}
            title={canSend ? undefined : 'No payout wallet is configured on payment-service'}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius-sm)',
              border: canSend ? 'none' : '1px solid var(--tec-border)',
              background: canSend ? 'linear-gradient(135deg,var(--tec-gold),#E8962A)' : 'transparent',
              color: canSend ? '#1a1200' : 'var(--tec-text-3)',
              fontWeight: 800, fontSize: 12, font: 'inherit',
              cursor: busy || !canSend ? 'default' : 'pointer',
              opacity: busy ? 0.6 : 1,
            }}>
            {busy ? 'Sending…' : `Send ${claim.amount_pi} π now`}
          </button>
          {/* Green and solid whenever "Send now" cannot run. Sending by hand
              is not a fallback here — it is the whole way this works until an
              app wallet exists, and a screen whose only prominent button is
              dead teaches people the page is broken. */}
          <button onClick={() => { void act('paid'); }} disabled={busy} style={{
            padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: canSend
              ? 'var(--tec-fill-soft)'
              : 'linear-gradient(135deg,var(--tec-green),#16A34A)',
            color: canSend ? 'var(--tec-text-1)' : '#05130a',
            fontWeight: 800, fontSize: 12,
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
            {canSend ? (
              <>
                <strong>Send now</strong> transfers the Pi from the payout wallet and records the
                real transaction. <strong>Mark sent</strong> only records one you already sent by
                hand — paste its hash first.
              </>
            ) : (
              <>
                Send the Pi from your own wallet to the address above, then paste the transaction
                hash and <strong>Mark sent</strong>. <strong>Send now</strong> needs an app wallet
                on payment-service, and there is none yet.
              </>
            )}
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
  const router = useRouter();
  const { user, isLoading: authLoading } = usePiAuth();
  const isAdmin = (user as { role?: string } | null)?.role === 'admin';

  const [claims,  setClaims]  = useState<Claim[]>([]);
  const [filter,  setFilter]  = useState<Status | 'ALL'>('CLAIMED');
  // Finding ONE claim in a hundred.
  //
  // Client-side, over what is already loaded, because the whole round is 100
  // rows and a round trip per keystroke would be a worse answer to a smaller
  // problem. If a round ever outgrows one page this moves to the service —
  // which is a different change, and it will be obvious when it is needed.
  const [q, setQ] = useState('');
  // First load only — see the note on the pioneer page. Recording one payout
  // used to replace the whole queue with grey blocks and rebuild it, which is
  // the worst moment to lose your place in a list you are working down.
  const [loading, setLoading] = useState(true);
  const firstLoad = useRef(true);
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
    if (firstLoad.current) setLoading(true);
    setError(null);
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
      firstLoad.current = false;
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

  /**
   * Seat, username or address — the three things somebody arrives holding.
   *
   * A pioneer asking "where is my Pi" gives you a username. A transfer you are
   * checking gives you an address. A note you wrote gives you a seat. All three
   * are matched, case-insensitively, because none of them is typed carefully on
   * a phone.
   */
  const needle  = q.trim().toLowerCase();
  const shown   = needle
    ? claims.filter((c) =>
        c.owner.toLowerCase().includes(needle)
        || c.wallet_address.toLowerCase().includes(needle)
        || String(c.seat ?? '').includes(needle))
    : claims;

  /**
   * The queue as a file.
   *
   * Reconciliation is already done — every `tx_id` was verified against the
   * chain when it was written, so this is not proving anything. It is for the
   * work AROUND the payouts: a total to report, a list to check against a
   * wallet's own history, a record that outlives a browser tab.
   *
   * Built from what is on screen, so an export matches what was exported: the
   * filter and the search both apply, and a file that silently contained more
   * than the list above it would be a quiet lie.
   *
   * Every field is quoted and internal quotes are doubled — a username is
   * user-supplied text, and a bare comma in one would shift every later column
   * into the wrong header.
   */
  const exportCsv = () => {
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['seat', 'owner', 'status', 'amount_pi', 'wallet_address', 'tx_id', 'claimed_at', 'note'],
      ...shown.map((c) => [
        c.seat ?? '', c.owner, c.status, c.amount_pi,
        c.wallet_address, c.tx_id ?? '', c.created_at, c.note ?? '',
      ]),
    ].map((r) => r.map(cell).join(',')).join('\r\n');

    try {
      // BOM: Excel reads a CSV without one as the system codepage, which turns
      // any non-ASCII username into mojibake.
      const url = URL.createObjectURL(new Blob(['\uFEFF' + rows], { type: 'text/csv;charset=utf-8' }));
      const a   = document.createElement('a');
      a.href = url;
      a.download = `campaign-${filter.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* a blocked download is not worth an error banner */ }
  };

  return (
    <HubSubShell
      title="Campaign payouts"
      subtitle="Admin — who is waiting for Pi"
      loading={authLoading || loading}
      backTo="/hub/campaign"
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

          {/* The way out of "it is still broken" with no way to see why.
              Read-only, and it prints what the server actually answered —
              which is the thing a screenshot of a screen cannot show. */}
          <button
            onClick={() => router.push('/hub/admin/campaign/diagnose')}
            style={{
              display: 'block', marginBottom: 'var(--sp-3)',
              background: 'none', border: 'none', padding: 0,
              color: 'var(--tec-text-3)', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', font: 'inherit', textAlign: 'start',
            }}
          >
            Something not working? Run diagnostics →
          </button>

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

          {claims.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--sp-3)', flexWrap: 'wrap' }}>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Seat, username or address"
                dir="ltr"
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                aria-label="Find a claim"
                style={{
                  flex: 1, minWidth: 180, boxSizing: 'border-box',
                  background: 'var(--tec-fill-soft)', border: '1px solid var(--tec-border)',
                  borderRadius: 'var(--radius-sm)', padding: '9px 12px',
                  color: 'var(--tec-text-1)', fontSize: 12, outline: 'none', font: 'inherit',
                }}
              />
              <button
                onClick={exportCsv}
                title="Download what is listed below"
                style={{
                  flexShrink: 0, padding: '9px 14px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--tec-fill-soft)', border: '1px solid var(--tec-border)',
                  color: 'var(--tec-text-2)', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', font: 'inherit',
                }}
              >
                Export CSV
              </button>
            </div>
          )}

          {filter === 'CLAIMED' && claims.length > 0 && (
            <div dir="ltr" style={{
              padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-3)',
              background: 'var(--tec-fill-softer)', border: '1px solid var(--tec-border)',
              borderRadius: 'var(--radius-md)', fontSize: 12.5, color: 'var(--tec-text-2)',
            }}>
              {claims.length} waiting · {owed} π to send
              {/* The total is always the WHOLE queue, never the search result.
                  A number that shrinks as you type is a number that will be
                  read as the amount owed, and reported as one. */}
              {needle && shown.length !== claims.length && (
                <span style={{ color: 'var(--tec-text-3)' }}> · showing {shown.length}</span>
              )}
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
          ) : shown.length === 0 && !loading ? (
            <div style={{ textAlign: 'center', padding: 'var(--sp-10) var(--sp-6)', color: 'var(--tec-text-3)', fontSize: 'var(--text-sm)' }}>
              {/* "No match" and "nobody is waiting" are different facts, and an
                  admin who read the second while the first was true would
                  conclude the queue had emptied. */}
              {needle
                ? `No claim matches “${q.trim()}” in ${filter === 'ALL' ? 'any status' : filter}.`
                : filter === 'CLAIMED' ? 'Nobody is waiting for a payout.' : 'Nothing here.'}
            </div>
          ) : (
            shown.map((c) => (
              <Row
                key={c.id} claim={c} onDone={() => void load(filter)}
                // Unknown status → treated as CAN send, so a status line that
                // failed to load never disables the working button. The service
                // refuses either way; this only decides which control leads.
                canSend={wallet?.configured !== false}
              />
            ))
          )}
        </>
      )}
    </HubSubShell>
  );
}
