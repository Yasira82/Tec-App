'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePiAuth }   from '@/lib-client/hooks/usePiAuth';
import { useHandoffLinks } from '@/lib-client/handoff-links';
import { HubSubShell } from '@/components/hub';
import { Icon }        from '@/components/ui/Icon';
import { getDomain }   from '@/domains/_registry';
import { getSource }   from '@/lib-client/campaign';
import { rememberReturn, clearReturn } from '@/lib-client/return-to';
import { useBackGoesToHub } from '@/lib-client/back-to-hub';
import { useTranslation, fill } from '@/lib/i18n';

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
    /**
     * Why a claimed seat has not been paid — and only ever something the
     * person can act on. The service sends null for everything else, so a
     * failure that is ours never appears here as if it were theirs.
     */
    payout_blocked?: string | null;
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
  /**
   * WHY it is closed. Null while open.
   *
   * `open: false` carried two opposite facts — the round is not configured, and
   * every seat is taken — and this page told the same story about both. So the
   * 101st pioneer, arriving at the moment the campaign had SUCCEEDED, read
   * "No campaign is running" and reasonably concluded they had been sent
   * somewhere fake.
   */
  closed_reason?: 'not_configured' | 'full' | null;
}

const linkFor = (slug: string) => getDomain(slug)?.route ?? `https://${slug}.tecosystem.app`;

/**
 * Tell the app this visitor came from the CAMPAIGN, so it can offer a way back
 * to this page rather than to the Founding Quest.
 *
 * ── Why the app has to carry the way back ──────────────────────────────────
 *
 * Pi Browser has NO TABS, so the `target="_blank"` below is inert there and
 * this page does not stay open behind the mission. That leaves one history
 * stack, and a first visit to any app pushes its whole SSO chain onto it:
 * pressing back surfaces at the Hub's own landing, a "Sign in with Pi" screen
 * for a session the pioneer already has. `rememberReturn` below solves the
 * SSO-bounce half; this solves the "I am standing in the app and want to go
 * back" half, which nothing did.
 *
 * `2` is an index into a closed table in each app (`1` is the Founding Quest).
 * A path in the URL would have been shorter and would have let a stranger
 * choose what an app renders as its way home — on the one screen a pioneer
 * trusts to tell them where to go next. It is matched, never echoed.
 *
 * ── Why the host is checked ────────────────────────────────────────────────
 *
 * Every mission today lands on `*.tecosystem.app` — including the Connection
 * invite, which is `connection.tecosystem.app/app?invite=…` and gets the mark
 * like any other. (A first draft of this comment called that invite a foreign
 * chat URL and used it to justify the guard. It is not, and a render test
 * asserting the exact href said so.)
 *
 * The guard stays anyway, on the narrower claim that is actually true: this
 * function takes whatever `hrefFor` returns, one branch of which is a value
 * that arrives from the SERVICE (`connection_invite_url`). Annotating a URL we
 * do not own puts our campaign plumbing on somebody else's page, for a reader
 * that would never look at it. Cheap to hold, and the day a mission points off
 * our domains it is already right.
 */
const CAMPAIGN_RETURN_MARK = '2';

function withReturnMark(href: string): string {
  try {
    const u = new URL(href);
    if (!/(^|\.)tecosystem\.app$/i.test(u.hostname)) return href;
    u.searchParams.set('q', CAMPAIGN_RETURN_MARK);
    return u.toString();
  } catch {
    // Not an absolute URL — nothing here can safely be annotated.
    return href;
  }
}

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
 * Missions tapped on THIS page, kept locally so a lost POST can be re-sent.
 *
 * This became necessary the moment a campaign visit stopped being openable by
 * anything but a tap here. Before that, the app's own arrival report created
 * the row, so a `keepalive` POST that died in flight was quietly rescued. Now
 * nothing rescues it, and a mission that never registers is the failure this
 * page exists to avoid — "worse than closed: it looks open".
 *
 * The `/pioneers` page has carried the same re-send for the same reason.
 */
const TAPPED_KEY = 'tec_campaign_tapped';

const readTapped = (): string[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(TAPPED_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string') : [];
  } catch { return []; /* blocked or corrupt — the tap simply has no backup */ }
};

const rememberTapped = (slug: string) => {
  try {
    const next = readTapped();
    if (!next.includes(slug)) localStorage.setItem(TAPPED_KEY, JSON.stringify([...next, slug]));
  } catch { /* ignore */ }
};

/**
 * The POST alone — no side effects on this browser.
 *
 * Split out so the lost-tap re-send below can use it. The re-send runs on
 * page LOAD, while the pioneer is standing on this page and going nowhere; if
 * it went through `recordOpen` it would also `rememberReturn('/hub/campaign')`,
 * and the next time they tapped Home the Hub root would consume that and send
 * them straight back here.
 */
const sendVisit = (slug: string) => {
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
      body: JSON.stringify({
        app: slug,
        origin: 'campaign',
        ...(getSource() ? { source: getSource() } : {}),
      }),
    }).catch(() => {});
  } catch { /* ignore */ }
};

/**
 * Record that this pioneer opened an app.
 *
 * The mission links here used not to record anything, so a pioneer could open
 * all eight apps and stay at zero, with no way ever to reach the claim form. A
 * campaign whose missions cannot be completed is worse than one that is closed:
 * it looks open.
 *
 * ── What it records, and what it deliberately does not ─────────────────────
 *
 * A campaign visit, and only that. The write used to land in the Founding
 * Quest's `opened_apps` as well — one endpoint served both pages — so a pioneer
 * who finished the missions here opened `/pioneers` to find its apps already
 * ticked: a permanent badge, and one of a hundred seats, granted for work that
 * page never saw them do. (An earlier version of this comment said the campaign
 * READS `opened_apps`. It has not for some time: it keeps its own timestamped
 * `CampaignVisit` rows, precisely so an old Founding visit cannot claim fresh
 * Pi. `origin: 'campaign'` is the same idea pointing the other way.)
 *
 * `keepalive` because these missions may leave the page, and a fetch in flight
 * when the tab navigates is cancelled — the exact way the Founding open was lost
 * before. Best-effort and silent: a failed record must never block the visit.
 */
const recordOpen = (slug: string) => {
  rememberTapped(slug);
  // Remember where they were BEFORE the mission takes them away.
  //
  // A mission leads to another tecosystem.app app, which may bounce through the
  // Hub's SSO to resolve its own session. Coming back then walks into the middle
  // of that chain and lands on the sign-in page — with the campaign, and the
  // reason they were signing in at all, nowhere on screen. The Hub already knows
  // how to forward a remembered destination after a bounce; this was the one
  // place that never told it where the person had been standing.
  try { rememberReturn('/hub/campaign'); } catch { /* ignore */ }
  sendVisit(slug);
};

function Mission({ slug, done, needsAction, locale, href, onOpen, hintConnection, hintChat }: {
  slug: string; done: boolean; needsAction: boolean; locale: 'en' | 'ar';
  href: string;
  onOpen: (slug: string) => void;
  hintConnection: string; hintChat: string;
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
            {slug === 'connection' ? hintConnection : hintChat}
          </div>
        )}
      </div>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-gold)' }}>→</span>
    </a>
  );
}

/**
 * Hand the campaign to somebody else.
 *
 * The Connection mission is the campaign's only distribution channel — it puts
 * a pioneer in a group where the next one might see them. This is the other
 * half, and the cheaper half: the person already on the page is the one most
 * likely to know somebody who would want the π.
 *
 * `navigator.share` when the browser has it (Pi Browser does — it is a sheet
 * with WhatsApp and Telegram in it, which is where these conversations happen),
 * and the clipboard when it does not. A button that silently does nothing on
 * one of the two is a button that teaches people not to press it.
 *
 * An `AbortError` is the person changing their mind, not a failure, so it is
 * swallowed without the "copied" confirmation a real copy earns.
 */
function ShareCampaign({ label, copied: copiedLabel, text }: {
  label: string; copied: string; text: string;
}) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    // The live URL, read from the browser rather than hardcoded, so a preview
    // deployment shares itself and not production.
    const url = typeof window === 'undefined' ? '' : window.location.href;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Cancelled, or no clipboard permission. Nothing to report either way —
      // and nothing to claim, which is why `copied` is not set here.
    }
  };

  return (
    <button
      onClick={() => { void share(); }}
      style={{
        background: 'var(--tec-fill-soft)', border: '1px solid var(--tec-border)',
        borderRadius: 10, padding: '7px 12px', color: 'var(--tec-text-1)',
        fontSize: 12, fontWeight: 700, cursor: 'pointer', font: 'inherit',
        whiteSpace: 'nowrap',
      }}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}

export default function CampaignPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, logout } = usePiAuth();
  const { t, dir } = useTranslation();
  const c = t.hub.campaignPage;
  const locale: 'en' | 'ar' = dir === 'rtl' ? 'ar' : 'en';

  // Back on the campaign: whatever an earlier tap remembered is from a trip
  // that is over (see clearReturn). The Quest does the same.
  useEffect(() => { clearReturn(); }, []);

  // Same trap as the Quest: an app's "Back to the campaign" bar leaves the app
  // behind this page. Back from here goes to the Hub (lib-client/back-to-hub.ts).
  useBackGoesToHub('/hub/campaign');

  const [status,  setStatus]  = useState<Status | null>(null);
  const [me,      setMe]      = useState<Me | null>(null);
  /**
   * Does this account still need to sign in again before it can be paid?
   *
   * Pi resolves a uid to a wallet only for an app the person granted
   * `wallet_address`, and Pi cannot widen a consent already given. Everyone who
   * signed in before 2026-09-13 must sign in once more — and this page is where
   * the reward is promised, so it is where the one thing they can do belongs.
   *
   * Starts false so nothing flashes while it loads. The route fails open for
   * the same reason: a banner that appears because a service blipped is a
   * banner people learn to dismiss without reading.
   */
  const [needsReconsent, setNeedsReconsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  /**
   * First load only.
   *
   * Every mission opens a NEW TAB, so returning to this page is not an edge
   * case — it is the loop the page is built around, twenty-four times per
   * pioneer. `load()` used to raise this on every call, and the focus listener
   * calls `load()` on every return, so each one replaced the mission list with
   * grey blocks and rebuilt it.
   *
   * The refetch is right; the server is the only authority here and nothing is
   * ticked optimistically. What was wrong is that a REFRESH was presented as a
   * FIRST LOAD. Nobody reports this, because a flashing skeleton reads as "the
   * page is slow" rather than "the page is wrong".
   */
  const [loading, setLoading] = useState(true);
  const firstLoad = useRef(true);
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
  // The address, typed — the fallback route.
  //
  // Shown ONLY to somebody who finished the missions and has no address posted
  // in the group. For everybody else there is still nothing to type: their
  // address is read back to them and the seat is taken on its own.
  //
  // It came back because the group was a dead end. Using the chat and not
  // pasting 56 characters into it is not a failure to complete a mission, but
  // this screen treated it as one and offered nothing to do about it.
  const [claimAddr, setClaimAddr] = useState('');
  // Giving the seat back.
  //
  // The only way out of a claim used to be an admin REJECTING it — a verdict on
  // the person, delivered from a page they cannot reach, for what is usually
  // just "I claimed with the wrong account" or "I was testing this". The one
  // who changed their mind should be the one who can act on it.
  /**
   * The claim fires by itself, and exactly once.
   *
   * A ref rather than state: this must not re-run when the render that follows
   * the claim updates, and it must not wait for a render to take effect. Two
   * effects racing here would take two seats.
   */
  const autoClaimed = useRef(false);
  const [confirmDrop, setConfirmDrop] = useState(false);
  const [dropBusy,    setDropBusy]    = useState(false);
  const [dropErr,     setDropErr]     = useState<string | null>(null);

  const load = useCallback(async () => {
    // Only the very first call darkens the screen. Later ones update the
    // numbers underneath whatever the pioneer is already looking at.
    if (firstLoad.current) setLoading(true);
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

        // Asked alongside, never blocking: a person must still see their
        // progress if this one answer does not arrive.
        const c = await fetch('/api/bff/payout-consent', { credentials: 'include' })
          .then((r) => r.json()).catch(() => ({}));
        setNeedsReconsent(c?.needsReconsent === true);
      }
    } finally {
      firstLoad.current = false;
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { if (!authLoading) void load(); }, [authLoading, load]);

  /**
   * Re-send a mission tap the server never received.
   *
   * These links leave the page, and a fetch in flight when the browser
   * navigates is cancelled. `keepalive` covers most of it; nothing covers all
   * of it, and since a campaign visit can no longer be opened by the app's own
   * arrival report, a lost tap now means a mission that never ticks and a
   * pioneer who can never reach the claim form.
   *
   * The set difference IS the work list, and the writes are idempotent — the
   * service upserts one row per (owner, app). Bounded to one retry per app per
   * session so an app that stays untickable for another reason (`connection`
   * also needs a message sent) cannot turn this into a loop.
   */
  const resent = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!me) return;
    const done  = new Set(me.done ?? []);
    // Only THIS round's missions. The tapped list outlives rounds, and an app
    // from an earlier round is not something this campaign asked for.
    const asked = new Set(me.apps ?? []);
    for (const slug of readTapped()) {
      if (!asked.has(slug) || done.has(slug) || resent.current.has(slug)) continue;
      resent.current.add(slug);
      sendVisit(slug); // not recordOpen — see sendVisit for why
    }
  }, [me]);


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
      if (!res.ok) throw new Error(data?.message ?? data?.error ?? fill(c.failed, { status: res.status }));
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
      if (!res.ok) throw new Error(data?.message ?? data?.error ?? fill(c.failed, { status: res.status }));
      setConfirmDrop(false);
      await load();
    } catch (e) {
      setDropErr((e as Error).message);
    } finally {
      setDropBusy(false);
    }
  };

  const submit = async (typedAddress?: string) => {
    // The owner is never sent — the service takes it from the verified token.
    //
    // The ADDRESS may be, and only when the group has none: the service prefers
    // what was posted there and reads this only as a fallback. It cannot
    // redirect the Pi (A2U pays a uid and Pi resolves the wallet), and it is not
    // validated here — the service applies one checksum to both routes, and a
    // second opinion on this page is a second place for the rule to drift.
    const typed = (typedAddress ?? '').trim();
    setSending(true); setError(null);
    try {
      const res  = await fetch('/api/bff/campaign/claim', {
        method: 'POST', credentials: 'include',
        ...(typed ? {
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ wallet_address: typed }),
        } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The service's own sentence — it knows whether the address was missing,
        // unreadable, or already spent.
        throw new Error(data?.error?.message || data?.message || data?.error || c.couldNotClaim);
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

  /**
   * Take the seat as soon as there is nothing left to decide.
   *
   * Every condition is required. `eligible` means the missions are done;
   * `posted_address` means there is somewhere to send it; no active claim means
   * this is not a second seat. It fires once per visit — a failed attempt is
   * NOT retried automatically, because a retry loop against a claim endpoint is
   * how one pioneer becomes a hundred requests. The Try again control is there
   * for that, and a person is the one who taps it.
   */
  useEffect(() => {
    if (autoClaimed.current) return;
    if (!me?.eligible || !me.posted_address || activeClaim || sending) return;
    autoClaimed.current = true;
    void submit();
    // `submit` is stable enough for this: it closes over `load`, which is a
    // useCallback, and the guard above makes a second run impossible anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, activeClaim, sending]);
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

  // Each mission link, signed for the visitor while they are still HERE
  // (C-123 §12): the app opens standalone on its own domain, already signed in.
  const missionHrefs = (me?.apps ?? status?.apps ?? []).map((slug) => withReturnMark(hrefFor(slug)));
  const signed = useHandoffLinks(missionHrefs, isAuthenticated);

  return (
    <HubSubShell
      title={c.title}
      /**
       * Only when there are real numbers to show.
       *
       * `status` alone is not that test. When the gateway cannot be reached the
       * BFF fails closed with `{ data: { open: false } }` — correct, and truthy,
       * so this template ran over three fields that were not there and the header
       * read "undefined π · undefined of undefined seats left" above a body that
       * said "No campaign is running". The page contradicted itself in the one
       * place a visitor looks first.
       */
      subtitle={
        status && typeof status.reward_pi === 'number' && typeof status.seats === 'number'
          ? fill(c.seatsLeft, {
              reward:    status.reward_pi,
              remaining: status.remaining,
              seats:     status.seats,
            })
          : undefined
      }
      loading={authLoading || loading}
      /* Only while there is something to share. Handing somebody a link to a
         closed campaign sends them to the screen below — and the whole value of
         a share is that it arrives from someone they trust. */
      actions={status?.open
        ? <ShareCampaign label={c.share} copied={c.shareCopied} text={c.shareText} />
        : undefined}
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
              {c.adminTitle}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--tec-text-3)' }}>
              {c.adminSub}
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
          {/* "Full" and "not configured" are opposite outcomes, and this screen
              used to say the same thing about both — so the round's most
              successful moment read as proof it was never real. Unknown falls
              back to the neutral sentence rather than guessing. */}
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--tec-text-1)', marginBottom: 6 }}>
            {status?.closed_reason === 'full' ? c.fullTitle : c.closedTitle}
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', lineHeight: 1.7 }}>
            {status?.closed_reason === 'full'
              ? fill(c.fullSub, { seats: status?.seats ?? '' })
              : c.closedSub}
          </div>
        </div>
      ) : !isAuthenticated ? (
        /**
         * A sentence is not an invitation.
         *
         * `/hub` is not in PROTECTED_ROUTES, so this page is publicly reachable —
         * and a signed-out visitor met "Sign in with Pi to take part." as plain
         * text, with nothing to tap. On the one screen whose entire job is to turn
         * a visitor into a pioneer, that is a wall with no door.
         *
         * `rememberReturn` first: signing in bounces through the Hub, and without
         * it they land on the home page with no idea what they were doing. The
         * campaign is the reason they signed in; it should be where they come back.
         */
        <div style={{ textAlign: 'center', padding: 'var(--sp-10) var(--sp-6)' }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', marginBottom: 'var(--sp-4)' }}>
            {c.signedOut}
          </div>
          <button
            onClick={() => {
              try { rememberReturn('/hub/campaign'); } catch { /* ignore */ }
              router.push('/');
            }}
            style={{
              padding: '12px 24px', borderRadius: 'var(--radius-sm)', border: 'none',
              background: 'var(--tec-gold)', color: '#0B1020',
              fontWeight: 800, fontSize: 13, cursor: 'pointer', font: 'inherit',
            }}
          >
            {c.signIn}
          </button>
        </div>
      ) : (
        <>
          {/* ── Sign in again, or the reward cannot reach you ──
              Shown BEFORE the claim block on purpose: this is the one thing
              the person can do, and it is useful before they claim as well as
              after. It is not dismissible — dismissing it would not change the
              fact, and the banner disappears by itself the moment they act. */}
          {isAuthenticated && needsReconsent && (
            <div style={{
              background: 'rgba(251,180,74,0.10)',
              border: '1px solid var(--tec-border-gold)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)',
            }}>
              <div style={{ fontWeight: 800, fontSize: 'var(--text-sm)', color: 'var(--tec-gold)' }}>
                {c.reconsentTitle}
              </div>
              <div style={{ fontSize: 12, color: 'var(--tec-text-2)', marginTop: 6, lineHeight: 1.7 }}>
                {c.reconsentBody}
              </div>
              <button
                // The same sign-out Profile uses. Landing on `/` is what puts
                // them back at the Pi sign-in — which is the whole point: the
                // NEXT authenticate is the one that asks for the new scope.
                onClick={() => { logout(); router.push('/'); }}
                style={{
                  marginTop: 12, width: '100%', padding: '10px 12px',
                  background: 'var(--tec-gold)', color: '#0B1020',
                  border: 'none', borderRadius: 'var(--radius-sm)',
                  fontWeight: 800, fontSize: 13, cursor: 'pointer', font: 'inherit',
                }}
              >
                {c.reconsentCta}
              </button>
            </div>
          )}

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
                {claim.status === 'PAID'     ? fill(c.paidTitle, { reward: me?.reward_pi ?? '' })
                 : claim.status === 'REJECTED' ? c.rejectedTitle
                 : claim.payout_blocked        ? fill(c.seatBlocked, { seat: claim.seat ?? '' })
                 : fill(c.seatYours, { seat: claim.seat ?? '' })}
              </div>

              {/* The seat is theirs and the payout cannot go out until they do
                  something. Saying "be patient" here would be false: the wait
                  has no end unless they act. Shown ABOVE the reassurance, and
                  in a colour that is not the calm one. */}
              {claim.status === 'CLAIMED' && claim.payout_blocked && (
                <div style={{
                  marginTop: 10, padding: 'var(--sp-3)',
                  background: 'rgba(251,180,74,0.10)',
                  border: '1px solid var(--tec-border-gold)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12, lineHeight: 1.7, color: 'var(--tec-text-2)',
                }}>
                  {claim.payout_blocked}
                </div>
              )}
              {/* Said plainly. A person sends this by hand, and a screen that
                  implies an instant payout turns a normal wait into a
                  suspicion that they have been cheated. */}
              <div style={{ fontSize: 12, color: 'var(--tec-text-3)', marginTop: 6, lineHeight: 1.6 }}>
                {claim.status === 'CLAIMED'
                  // Not repeated once the block above has said the wait has a
                  // cause. Two messages about the same wait, one of them
                  // reassuring, reads as though the first can be ignored.
                  ? (claim.payout_blocked ? c.waitBlocked : c.waitNormal)
                  : claim.status === 'PAID'
                    ? c.paidBody
                    // Says what to DO. "Contact us" alone, on a screen with no
                    // way forward, reads as a polite no.
                    : c.rejectedBody}
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
                  {c.changeAddr}
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
                    aria-label={c.addrLabel}
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
                      {c.save}
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
                      {c.cancel}
                    </button>
                  </div>
                  {/* Your seat is not at stake. Somebody who thinks correcting
                      a typo costs them their place will leave it wrong. */}
                  <p style={{ margin: '8px 0 0', fontSize: 11, lineHeight: 1.5, color: 'var(--tec-text-3)' }}>
                    {fill(c.keepSeat, { seat: claim.seat ?? '' })}
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
                      {c.dropCta}
                    </button>
                  ) : (
                    <>
                      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: 'var(--tec-text-2)' }}>
                        {fill(c.dropConfirm, { seat: claim.seat ?? '' })}
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
                          {c.dropYes}
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
                          {c.dropNo}
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
              {/* The loudest thing on the screen, and deliberately so — and it
                  sits ABOVE the missions, not down beside the claim.
                  "Send us your wallet address" is a shape people are phished
                  with, and the Connection mission is where this screen asks for
                  one: it says "post your Pi wallet address there". A warning
                  that arrives after that instruction arrives after the moment
                  it exists to protect. So it is read first, by everyone the
                  round is open to — not only by whoever already finished the
                  list. */}
              <div style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 'var(--radius-md)', padding: 'var(--sp-3) var(--sp-4)',
                marginBottom: 'var(--sp-3)',
              }}>
                <Icon name="shield" size={16} color="var(--tec-red)" />
                <div style={{ fontSize: 12, color: 'var(--tec-text-2)', lineHeight: 1.6 }}>
                  {c.neverAsk1} <strong>{c.neverAsk2}</strong> {c.neverAsk3}{' '}
                  <strong>{c.neverAsk4}</strong>{c.neverAsk5} <code>G</code>.
                </div>
              </div>

              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', marginBottom: 'var(--sp-3)', lineHeight: 1.6 }}>
                {fill(c.missionsIntro, { reward: me?.reward_pi ?? status?.reward_pi ?? '' })}
              </div>

              {(me?.apps ?? status?.apps ?? []).map((slug) => (
                <Mission
                  key={slug}
                  slug={slug}
                  done={me?.done.includes(slug) ?? false}
                  needsAction={me?.action_apps.includes(slug) ?? false}
                  locale={locale}
                  href={signed(withReturnMark(hrefFor(slug)))}
                  onOpen={(s) => { recordOpen(s); signed.spent(withReturnMark(hrefFor(s))); }}
                  hintConnection={c.missionConnection}
                  hintChat={c.missionChat}
                />
              ))}

              {/* ── Claim ──────────────────────────────────── */}
              <div style={{ marginTop: 'var(--sp-5)' }}>
                {!me?.eligible ? (
                  <div style={{ fontSize: 12.5, color: 'var(--tec-text-3)', textAlign: 'center' }}>
                    {c.finishFirst}
                  </div>
                ) : !me?.posted_address ? (
                  <>
                    {/* Nothing in the group — so ask, here, once.
                        This is the ONLY screen that asks for an address, and it
                        is reached only by somebody who finished every mission
                        and did not post one. The warning above the missions has
                        already said what we will never ask for. */}
                    <div style={{ fontSize: 12.5, color: 'var(--tec-text-2)', lineHeight: 1.7, marginBottom: 'var(--sp-3)' }}>
                      {c.typeAddrIntro}
                    </div>
                    <input
                      value={claimAddr}
                      onChange={(e) => { setClaimAddr(e.target.value); if (error) setError(null); }}
                      dir="ltr"
                      spellCheck={false}
                      autoCapitalize="none"
                      autoCorrect="off"
                      placeholder="G…"
                      aria-label={c.addrLabel}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: 'var(--tec-fill-soft)', border: '1px solid var(--tec-border)',
                        borderRadius: 'var(--radius-sm)', padding: '12px 14px',
                        color: 'var(--tec-text-1)', fontSize: 12,
                        fontFamily: 'var(--font-mono)', outline: 'none',
                      }}
                    />
                    <button
                      onClick={() => { void submit(claimAddr); }}
                      disabled={sending || claimAddr.trim().length === 0}
                      style={{
                        width: '100%', marginTop: 'var(--sp-3)',
                        padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
                        background: 'var(--tec-gold)', color: '#1A1205',
                        fontSize: 14, fontWeight: 800,
                        opacity: sending || claimAddr.trim().length === 0 ? 0.5 : 1,
                        cursor: sending ? 'default' : 'pointer', font: 'inherit',
                      }}
                    >
                      {sending ? c.taking : fill(c.claimWithAddr, { reward: me?.reward_pi ?? '' })}
                    </button>
                    <div style={{ fontSize: 11.5, color: 'var(--tec-text-3)', marginTop: 8, lineHeight: 1.6 }}>
                      {c.orPostInstead}
                    </div>

                    {error && (
                      <div role="alert" style={{
                        marginTop: 10, color: 'var(--tec-red)', fontSize: 12.5, lineHeight: 1.6,
                      }}>
                        {error}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* The address, READ BACK — not typed.
                        It comes from their own message in the TEC group, and
                        showing it is the whole safety of the flow: an address
                        nobody ever saw is one nobody can catch being wrong.
                        Monospaced and full width, because this is the string
                        the campaign holds for them. */}
                    <div style={{ marginBottom: 'var(--sp-3)' }}>
                      <div style={{ fontSize: 12, color: 'var(--tec-text-3)', marginBottom: 6 }}>
                        {c.willSendTo}
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
                        {c.notRightOne}
                      </div>
                    </div>

                    {/* No button. The seat is taken the moment there is
                        nothing left to decide: the missions are done and an
                        address is on record. Asking somebody to confirm what
                        they already did is a step that only exists to be
                        forgotten — and this one used to be the last thing
                        between a pioneer and their Pi. */}
                    <div style={{
                      marginTop: 'var(--sp-3)', textAlign: 'center',
                      fontSize: 13, fontWeight: 700,
                      color: error ? 'var(--tec-red)' : 'var(--tec-gold)',
                    }}>
                      {sending ? c.taking : error ? '' : fill(c.claiming, { reward: me?.reward_pi ?? '' })}
                    </div>

                    {error && (
                      <div role="alert" style={{
                        marginTop: 8, color: 'var(--tec-red)', fontSize: 12.5, lineHeight: 1.6,
                        textAlign: 'center',
                      }}>
                        {error}
                        {/* The one control that survives, and only on failure.
                            A flow with no button is fine while it works; with
                            no way to retry after a dropped connection it would
                            strand somebody who did everything asked of them. */}
                        <button
                          onClick={() => { void submit(); }}
                          disabled={sending}
                          style={{
                            display: 'block', margin: '8px auto 0',
                            background: 'none', border: 'none', padding: 0,
                            color: 'var(--tec-gold)', fontSize: 12.5, fontWeight: 700,
                            cursor: 'pointer', font: 'inherit',
                          }}
                        >
                          {c.tryAgain}
                        </button>
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
