'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePiAuth }   from '@/lib-client/hooks/usePiAuth';
import { HubSubShell } from '@/components/hub';
import { Icon }        from '@/components/ui/Icon';
import { getDomain }   from '@/domains/_registry';
import { getSource }   from '@/lib-client/campaign';
import { rememberReturn } from '@/lib-client/return-to';
import { useTranslation } from '@/lib/i18n';

/**
 * The Pi reward campaign.
 *
 * Visit a short list of apps, post your wallet address in the TEC group, and
 * claim. The address is never typed here — it is read from that message, so a
 * request cannot name where the Pi goes.
 * The transfer is made by a person — the platform has no way to pay Pi out —
 * so this screen's job is to be honest about that wait rather than imply an
 * instant payout that will not come.
 */

interface Me {
  apps:        string[];
  action_apps: string[];
  /** Where the Connection mission happens — the group invite, from the service. */
  connection_invite_url?: string;
  done:        string[];
  missing:     string[];
  /** The address read out of their own message in the TEC group, if any. */
  posted_address: string | null;
  eligible:    boolean;
  reward_pi:   number;
  claim: null | {
    seat:           number | null;
    status:         'CLAIMED' | 'PAID' | 'REJECTED';
    wallet_address: string;
    tx_id:          string | null;
    paid_at:        string | null;
  };
}

interface Status {
  connection_invite_url?: string;
  reward_pi: number;
  seats:     number;
  claimed:   number;
  remaining: number;
  apps:      string[];
  open:      boolean;
}

const linkFor = (slug: string) => getDomain(slug)?.route ?? `https://${slug}.tecosystem.app`;

/**
 * The registry's name is localized (`{ en, ar }`), so it cannot be rendered as
 * it stands — React refuses an object as a child, which is what the type error
 * was telling us. Read the caller's language, and fall back to the slug rather
 * than to an empty label.
 */
const nameOf = (slug: string, locale: 'en' | 'ar') => {
  const n = getDomain(slug)?.name;
  if (!n) return slug;
  return typeof n === 'string' ? n : (n[locale] ?? n.en ?? slug);
};

/**
 * Record that this pioneer opened an app.
 *
 * The campaign reads the SAME `PioneerQuest.opened_apps` the Founding Quest
 * writes — which is only true if somebody writes it. The Founding page does
 * this on every app link; the mission links here did not, so a pioneer could
 * open all eight apps and stay at zero, with no way ever to reach the claim
 * form. A campaign whose missions cannot be completed is worse than one that is
 * closed: it looks open.
 *
 * `keepalive` because these missions may leave the page, and a fetch in flight
 * when the tab navigates is cancelled — the exact way the Founding open was lost
 * before. Best-effort and silent: a failed record must never block the visit.
 */
const recordOpen = (slug: string) => {
  // Remember where they were BEFORE the mission takes them away.
  //
  // A mission leads to another tecosystem.app app, which may bounce through the
  // Hub's SSO to resolve its own session. Coming back then walks into the middle
  // of that chain and lands on the sign-in page — with the campaign, and the
  // reason they were signing in at all, nowhere on screen. The Hub already knows
  // how to forward a remembered destination after a bounce; this was the one
  // place that never told it where the person had been standing.
  try { rememberReturn('/hub/campaign'); } catch { /* ignore */ }
  try {
    const csrf = document.cookie.match(/(?:^|;\s*)tec_csrf=([^;]+)/)?.[1] ?? '';
    void fetch('/api/bff/pioneer/open', {
      method:      'POST',
      credentials: 'include',
      keepalive:   true,
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'x-csrf-token': decodeURIComponent(csrf) } : {}),
      },
      body: JSON.stringify({ app: slug, ...(getSource() ? { source: getSource() } : {}) }),
    }).catch(() => {});
  } catch { /* ignore */ }
};

function Mission({ slug, done, needsAction, locale, href, onOpen }: {
  slug: string; done: boolean; needsAction: boolean; locale: 'en' | 'ar';
  href: string;
  onOpen: (slug: string) => void;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onOpen(slug)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none',
        background: 'var(--tec-surface)',
        border: `1px solid ${done ? 'rgba(34,197,94,0.3)' : 'var(--tec-border)'}`,
        borderRadius: 'var(--radius-md)', padding: 'var(--sp-3) var(--sp-4)',
        marginBottom: 'var(--sp-2)',
      }}
    >
      <span style={{ fontSize: 18 }}>{done ? '✅' : '○'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--tec-text-1)' }}>
          {nameOf(slug, locale)}
        </div>
        {/* An action app says what to DO, not just where to go — telling someone
            already standing in Connection to "visit Connection" is the fastest
            way to make a screen feel broken. */}
        {needsAction && !done && (
          <div style={{ fontSize: 11.5, color: 'var(--tec-gold)', marginTop: 2 }}>
            {slug === 'connection'
              ? 'This link puts you in the TEC group — post your Pi wallet address there. That is where we send the reward.'
              : 'Open a chat and send one message — opening the app is not enough here'}
          </div>
        )}
      </div>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-gold)' }}>→</span>
    </a>
  );
}

export default function CampaignPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = usePiAuth();
  const { dir } = useTranslation();
  const locale: 'en' | 'ar' = dir === 'rtl' ? 'ar' : 'en';

  const [status,  setStatus]  = useState<Status | null>(null);
  const [me,      setMe]      = useState<Me | null>(null);
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Correcting the address on a claim that has not been paid yet.
  //
  // A wallet address is 56 characters that mean nothing to a human, pasted from
  // one app into another — getting it wrong is the expected failure of that
  // task, not a rare accident. There was no way back from this screen: the only
  // remedy was an admin REJECTING the claim, which reads like an accusation for
  // a paste error and cannot be asked for from here.
  const [editing, setEditing] = useState(false);
  const [newAddr, setNewAddr] = useState('');
  const [fixBusy, setFixBusy] = useState(false);
  const [fixErr,  setFixErr]  = useState<string | null>(null);
  // Giving the seat back.
  //
  // The only way out of a claim used to be an admin REJECTING it — a verdict on
  // the person, delivered from a page they cannot reach, for what is usually
  // just "I claimed with the wrong account" or "I was testing this". The one
  // who changed their mind should be the one who can act on it.
  const [confirmDrop, setConfirmDrop] = useState(false);
  const [dropBusy,    setDropBusy]    = useState(false);
  const [dropErr,     setDropErr]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // TWO different envelopes, and reading one as the other is what broke this
      // page. `status` is a plain route that passes the SERVICE body straight
      // through, so it arrives wrapped: { success, data }. `me` goes through
      // createHandler, which responds with the handler's return value at the TOP
      // LEVEL — no `data` key at all. Reading `m.data` there yielded undefined,
      // so `me` was null forever: no ticks, no Connection hint, and "Finish the
      // list above to claim." with no way to ever finish it.
      const s = await fetch('/api/bff/campaign/status', { credentials: 'include' })
        .then((r) => r.json()).catch(() => ({}));
      setStatus(s?.data ?? null);
      if (isAuthenticated) {
        const m = await fetch('/api/bff/campaign/me', { credentials: 'include' })
          .then((r) => r.json()).catch(() => ({}));
        // `apps` is the marker of a real payload — an error body has none, and
        // must not be mistaken for "this pioneer has done nothing" (P6).
        setMe(Array.isArray(m?.apps) ? (m as Me) : null);
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { if (!authLoading) void load(); }, [authLoading, load]);

  /**
   * Re-read progress when the pioneer comes back to this tab.
   *
   * Every mission opens in a new tab, so this page is never unmounted and never
   * re-fetches on its own — the ticks would stay empty until a manual reload,
   * which reads as "my visit did not count" precisely when it did. The server
   * stays the only authority: nothing is ticked optimistically, because
   * `connection` requires a message sent and a hopeful ✅ there would be a lie.
   */
  useEffect(() => {
    const onFocus = () => { if (!authLoading) void load(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [authLoading, load]);

  const changeAddress = async () => {
    setFixBusy(true); setFixErr(null);
    try {
      const res = await fetch('/api/bff/campaign/claim/address', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: newAddr.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      // The service knows WHICH way an address was wrong, and its sentence is
      // the only line a person can act on. A generic failure hides it.
      if (!res.ok) throw new Error(data?.message ?? data?.error ?? `Failed (${res.status})`);
      setEditing(false); setNewAddr('');
      await load();
    } catch (e) {
      setFixErr((e as Error).message);
    } finally {
      setFixBusy(false);
    }
  };

  const withdraw = async () => {
    setDropBusy(true); setDropErr(null);
    try {
      const res = await fetch('/api/bff/campaign/claim', {
        method: 'DELETE', credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      // The service refuses a PAID claim, and that sentence is the answer —
      // "could not cancel" would hide the only reason that matters.
      if (!res.ok) throw new Error(data?.message ?? data?.error ?? `Failed (${res.status})`);
      setConfirmDrop(false);
      await load();
    } catch (e) {
      setDropErr((e as Error).message);
    } finally {
      setDropBusy(false);
    }
  };

  const submit = async () => {
    // No body, and nothing to validate here: the address comes from the
    // pioneer's own message in the TEC group, read by the service. A payload
    // that could name where real Pi is sent is the one thing this request must
    // not carry.
    setSending(true); setError(null);
    try {
      const res  = await fetch('/api/bff/campaign/claim', {
        method: 'POST', credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The service's own sentence — it knows whether the address was missing,
        // unreadable, or already spent.
        throw new Error(data?.error?.message || data?.message || data?.error || 'Could not claim');
      }
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const claim   = me?.claim ?? null;

  /**
   * A REJECTED claim is not an active one.
   *
   * The service was changed to let a rejected pioneer claim again — a rejection
   * is a decision about that claim (a wrong address, a bad submission), not a
   * ban on the person, and this screen tells them to get in touch if it was a
   * mistake. This page was still treating any claim as final, so the rejected
   * pioneer met a dead end: the notice, and nothing to do about it. The offer
   * has to come back, or the sentence is decoration.
   */
  const activeClaim = claim && claim.status !== 'REJECTED' ? claim : null;
  const isAdmin = (user as { role?: string } | null)?.role === 'admin';

  /**
   * Where a mission link goes.
   *
   * Connection is the exception: the invite URL joins the pioneer to the TEC
   * group in one tap, with nobody to approve it. It comes from the service
   * rather than the bundle so re-creating the link (which revokes the old one)
   * is an env var and a restart, not a frontend rebuild.
   *
   * If it is unset the link falls back to the app itself — a mission that sends
   * someone to a broken URL is worse than one that sends them to the app and
   * lets them find the group.
   */
  const hrefFor = (slug: string) => {
    if (slug !== 'connection') return linkFor(slug);
    return me?.connection_invite_url || status?.connection_invite_url || linkFor(slug);
  };

  return (
    <HubSubShell
      title="Pi Reward Campaign"
      subtitle={status ? `${status.reward_pi} π · ${status.remaining} of ${status.seats} seats left` : 'Loading…'}
      loading={authLoading || loading}
    >
      {/* The payout queue, for the one person who can act on it.
          Reachable from Profile as well, but a link there is a detour when you
          are standing on this page wondering who has claimed. Gated on the
          role for looks only — the route and the service both check it again,
          and they are the ones that decide (P5). */}
      {isAdmin && (
        <button
          onClick={() => router.push('/hub/admin/campaign')}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            marginBottom: 'var(--sp-4)', padding: 'var(--sp-3) var(--sp-4)',
            background: 'var(--tec-fill-soft)',
            border: '1px solid var(--tec-border-gold)',
            borderRadius: 'var(--radius-md)', cursor: 'pointer',
            textAlign: 'start', font: 'inherit',
          }}
        >
          <span style={{ fontSize: 18 }}>π</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--tec-text-1)' }}>
              Campaign payouts
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--tec-text-3)' }}>
              Who has claimed, and where to send the Pi
            </div>
          </div>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-gold)' }}>→</span>
        </button>
      )}

      {/* "No campaign is running" is for somebody with NO claim at all.
          Keying it on `activeClaim` hid a rejected pioneer's own notice the
          moment the round closed — the record of what happened to them, gone,
          with nothing in its place. Any claim, in any state, keeps its detail. */}
      {!status?.open && !claim ? (
        <div style={{ textAlign: 'center', padding: 'var(--sp-10) var(--sp-6)' }}>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--tec-text-1)', marginBottom: 6 }}>
            No campaign is running
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)' }}>
            Check back — the next round will appear here.
          </div>
        </div>
      ) : !isAuthenticated ? (
        <div style={{ textAlign: 'center', padding: 'var(--sp-10) var(--sp-6)', fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)' }}>
          Sign in with Pi to take part.
        </div>
      ) : (
        <>
          {/* ── Where the claim stands ─────────────────────── */}
          {claim && (
            <div style={{
              background: claim.status === 'PAID' ? 'rgba(34,197,94,0.08)' : 'var(--tec-fill-soft)',
              border: `1px solid ${claim.status === 'PAID' ? 'rgba(34,197,94,0.3)' : 'var(--tec-border-gold)'}`,
              borderRadius: 'var(--radius-md)', padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)',
            }}>
              <div style={{
                fontWeight: 800, fontSize: 'var(--text-sm)',
                color: claim.status === 'PAID' ? 'var(--tec-green)' : 'var(--tec-gold)',
              }}>
                {claim.status === 'PAID'     ? `Sent — ${me?.reward_pi} π on its way`
                 : claim.status === 'REJECTED' ? 'This claim was not approved'
                 : `Seat #${claim.seat} is yours`}
              </div>
              {/* Said plainly. A person sends this by hand, and a screen that
                  implies an instant payout turns a normal wait into a
                  suspicion that they have been cheated. */}
              <div style={{ fontSize: 12, color: 'var(--tec-text-3)', marginTop: 6, lineHeight: 1.6 }}>
                {claim.status === 'CLAIMED'
                  ? 'A person sends the Pi by hand, so this is not instant. You will see the transaction id here when it is done.'
                  : claim.status === 'PAID'
                    ? 'Check your Pi wallet.'
                    // Says what to DO. "Contact us" alone, on a screen with no
                    // way forward, reads as a polite no.
                    : 'You can try again below — check the address carefully first. Contact us through the feedback form if you think this was a mistake.'}
              </div>
              <div dir="ltr" style={{
                marginTop: 8, fontSize: 11, fontFamily: 'var(--font-mono)',
                color: 'var(--tec-text-3)', overflowWrap: 'anywhere',
              }}>
                {claim.wallet_address}
                {claim.tx_id && <><br />tx: {claim.tx_id}</>}
              </div>

              {/* Offered ONLY while it is still waiting. Once the Pi has been
                  sent the address is where it went, and rewriting the record
                  afterwards would make it describe a transfer that never
                  happened — the service refuses it too. */}
              {claim.status === 'CLAIMED' && !editing && (
                <button
                  onClick={() => { setEditing(true); setNewAddr(claim.wallet_address); }}
                  style={{
                    marginTop: 10, background: 'none', border: 'none', padding: 0,
                    color: 'var(--tec-gold)', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', font: 'inherit',
                  }}
                >
                  Wrong address? Change it before it is sent
                </button>
              )}

              {claim.status === 'CLAIMED' && editing && (
                <div style={{ marginTop: 10 }}>
                  <input
                    value={newAddr}
                    onChange={(e) => { setNewAddr(e.target.value); if (fixErr) setFixErr(null); }}
                    dir="ltr"
                    spellCheck={false}
                    autoCapitalize="none"
                    autoCorrect="off"
                    aria-label="Your Pi wallet address"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'var(--tec-fill-soft)', border: '1px solid var(--tec-border)',
                      borderRadius: 'var(--radius-sm)', padding: '10px 12px',
                      color: 'var(--tec-text-1)', fontSize: 12,
                      fontFamily: 'var(--font-mono)', outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => { void changeAddress(); }} disabled={fixBusy}
                      style={{
                        padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
                        background: 'var(--tec-gold)', color: '#1a1200',
                        fontWeight: 800, fontSize: 12, font: 'inherit',
                        cursor: fixBusy ? 'default' : 'pointer', opacity: fixBusy ? 0.6 : 1,
                      }}
                    >
                      Save address
                    </button>
                    <button
                      onClick={() => { setEditing(false); setFixErr(null); }} disabled={fixBusy}
                      style={{
                        padding: '8px 14px', borderRadius: 'var(--radius-sm)',
                        background: 'transparent', border: '1px solid var(--tec-border)',
                        color: 'var(--tec-text-3)', fontWeight: 700, fontSize: 12,
                        font: 'inherit', cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  {/* Your seat is not at stake. Somebody who thinks correcting
                      a typo costs them their place will leave it wrong. */}
                  <p style={{ margin: '8px 0 0', fontSize: 11, lineHeight: 1.5, color: 'var(--tec-text-3)' }}>
                    You keep seat #{claim.seat}. Make sure this is the address YOUR wallet
                    receives on — not one you copied from a payment you were sent.
                  </p>
                  {fixErr && (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--tec-red)' }}>{fixErr}</p>
                  )}
                </div>
              )}

              {/* Give the seat back.
                  Under the address control, and quieter than it: correcting a
                  typo is the common case and should be the loud one. Asked
                  before it happens rather than armed by a double tap — the
                  question here is "do you mean to give up seat #1", which a
                  second tap on the same word does not ask. */}
              {claim.status === 'CLAIMED' && !editing && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--tec-border)' }}>
                  {!confirmDrop ? (
                    <button
                      onClick={() => { setConfirmDrop(true); setDropErr(null); }}
                      style={{
                        background: 'none', border: 'none', padding: 0,
                        color: 'var(--tec-text-3)', fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', font: 'inherit',
                      }}
                    >
                      I don’t want this seat — cancel my claim
                    </button>
                  ) : (
                    <>
                      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: 'var(--tec-text-2)' }}>
                        Seat #{claim.seat} goes back to the pool and your address is removed.
                        You can claim again later while seats last — but you may not get this
                        seat number.
                      </p>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => { void withdraw(); }} disabled={dropBusy}
                          style={{
                            padding: '8px 16px', borderRadius: 'var(--radius-sm)',
                            background: 'transparent', border: '1px solid var(--tec-red)',
                            color: 'var(--tec-red)', fontWeight: 800, fontSize: 12,
                            font: 'inherit', cursor: dropBusy ? 'default' : 'pointer',
                            opacity: dropBusy ? 0.6 : 1,
                          }}
                        >
                          Yes, cancel it
                        </button>
                        <button
                          onClick={() => { setConfirmDrop(false); setDropErr(null); }} disabled={dropBusy}
                          style={{
                            padding: '8px 14px', borderRadius: 'var(--radius-sm)',
                            background: 'transparent', border: '1px solid var(--tec-border)',
                            color: 'var(--tec-text-3)', fontWeight: 700, fontSize: 12,
                            font: 'inherit', cursor: 'pointer',
                          }}
                        >
                          Keep my seat
                        </button>
                      </div>
                      {dropErr && (
                        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--tec-red)' }}>{dropErr}</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Missions ───────────────────────────────────── */}
          {/* The missions come back for a rejected pioneer — but only while a
              round is actually open. Offering the form on a closed campaign
              invites a claim the service will refuse, and being refused twice
              reads as being refused personally. */}
          {!activeClaim && status?.open && (
            <>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', marginBottom: 'var(--sp-3)', lineHeight: 1.6 }}>
                Visit these apps, then claim {me?.reward_pi ?? status?.reward_pi} π. Free — there is no payment at any step.
              </div>

              {(me?.apps ?? status?.apps ?? []).map((slug) => (
                <Mission
                  key={slug}
                  slug={slug}
                  done={me?.done.includes(slug) ?? false}
                  needsAction={me?.action_apps.includes(slug) ?? false}
                  locale={locale}
                  href={hrefFor(slug)}
                  onOpen={recordOpen}
                />
              ))}

              {/* ── Claim ──────────────────────────────────── */}
              <div style={{ marginTop: 'var(--sp-5)' }}>
                {!me?.eligible ? (
                  <div style={{ fontSize: 12.5, color: 'var(--tec-text-3)', textAlign: 'center' }}>
                    Finish the list above to claim.
                  </div>
                ) : (
                  <>
                    {/* The loudest thing on the screen, and deliberately so.
                        "Send us your wallet address" is a shape people are
                        phished with; the only defence is to say, before they
                        type, exactly what we will never ask for. */}
                    <div style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                      background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)',
                      borderRadius: 'var(--radius-md)', padding: 'var(--sp-3) var(--sp-4)',
                      marginBottom: 'var(--sp-3)',
                    }}>
                      <Icon name="shield" size={16} color="var(--tec-red)" />
                      <div style={{ fontSize: 12, color: 'var(--tec-text-2)', lineHeight: 1.6 }}>
                        We will <strong>never</strong> ask for your passphrase or secret key — not here,
                        not in the group, not anywhere. Post only your <strong>public address</strong>,
                        the one that starts with <code>G</code>.
                      </div>
                    </div>

                    {/* The address, READ BACK — not typed.
                        It comes from their own message in the TEC group, and
                        showing it is the whole safety of the flow: a payout
                        destination nobody ever saw is one nobody can catch
                        being wrong. Monospaced and full width, because this is
                        the string the Pi actually goes to. */}
                    <div style={{ marginBottom: 'var(--sp-3)' }}>
                      <div style={{ fontSize: 12, color: 'var(--tec-text-3)', marginBottom: 6 }}>
                        We will send to the address you posted in the TEC group:
                      </div>
                      <code dir="ltr" style={{
                        display: 'block', fontSize: 12, lineHeight: 1.6,
                        fontFamily: 'var(--font-mono)', color: 'var(--tec-text-1)',
                        background: 'var(--tec-fill-soft)', border: '1px solid var(--tec-border-gold)',
                        borderRadius: 'var(--radius-md)', padding: 'var(--sp-3) var(--sp-4)',
                        overflowWrap: 'anywhere',
                      }}>
                        {me?.posted_address}
                      </code>
                      <div style={{ fontSize: 11.5, color: 'var(--tec-text-3)', marginTop: 6, lineHeight: 1.6 }}>
                        Not the right one? Post the correct address in the group — the
                        newest one you send is the one we use.
                      </div>
                    </div>

                    <button
                      onClick={() => { void submit(); }}
                      disabled={sending}
                      style={{
                        width: '100%', marginTop: 'var(--sp-3)',
                        background: 'linear-gradient(135deg,var(--tec-gold),var(--tec-gold-dark))',
                        color: 'var(--tec-on-gold)', border: 'none',
                        borderRadius: 'var(--radius-md)', padding: '12px',
                        fontSize: 'var(--text-sm)', fontWeight: 800,
                        cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1,
                        font: 'inherit',
                      }}
                    >
                      {sending ? 'Claiming…' : `Claim ${me?.reward_pi} π`}
                    </button>

                    {error && (
                      <div role="alert" style={{
                        marginTop: 8, color: 'var(--tec-red)', fontSize: 12.5, lineHeight: 1.6,
                      }}>
                        {error}
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}
    </HubSubShell>
  );
}
