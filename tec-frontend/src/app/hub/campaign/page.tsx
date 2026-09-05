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
 * Visit a short list of apps, use Connection, then say where to send the Pi.
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
              ? 'This link puts you in the TEC group — say hello there. Opening the app is not enough.'
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
  const [address, setAddress] = useState('');
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const submit = async () => {
    // The button is never disabled on an empty field — a control that refuses in
    // silence is the one form of validation a person cannot read.
    if (!address.trim()) { setError('Enter your Pi wallet address.'); return; }
    setSending(true); setError(null);
    try {
      const res  = await fetch('/api/bff/campaign/claim', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: address.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The service knows exactly which way the address was wrong.
        throw new Error(data?.error?.message || data?.message || data?.error || 'Could not claim');
      }
      setAddress('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const claim   = me?.claim ?? null;
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
                    : 'Contact us through the feedback form if you think this is a mistake.'}
              </div>
              <div dir="ltr" style={{
                marginTop: 8, fontSize: 11, fontFamily: 'var(--font-mono)',
                color: 'var(--tec-text-3)', overflowWrap: 'anywhere',
              }}>
                {claim.wallet_address}
                {claim.tx_id && <><br />tx: {claim.tx_id}</>}
              </div>
            </div>
          )}

          {/* ── Missions ───────────────────────────────────── */}
          {!claim && (
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
                        We will <strong>never</strong> ask for your passphrase or secret key — not here, not anywhere.
                        Paste only your <strong>public address</strong>, the one that starts with <code>G</code>.
                      </div>
                    </div>

                    <input
                      value={address}
                      onChange={(e) => { setAddress(e.target.value); if (error) setError(null); }}
                      placeholder="G…"
                      dir="ltr"
                      spellCheck={false}
                      autoCapitalize="off"
                      autoCorrect="off"
                      aria-label="Your Pi wallet address"
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: 'var(--tec-fill-soft)',
                        border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'var(--tec-border)'}`,
                        borderRadius: 'var(--radius-md)', padding: 'var(--sp-3) var(--sp-4)',
                        color: 'var(--tec-text-1)', fontSize: 13,
                        fontFamily: 'var(--font-mono)', outline: 'none',
                      }}
                    />

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
