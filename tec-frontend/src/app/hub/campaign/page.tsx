'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePiAuth }   from '@/lib-client/hooks/usePiAuth';
import { HubSubShell } from '@/components/hub';
import { Icon }        from '@/components/ui/Icon';
import { getDomain }   from '@/domains/_registry';
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

function Mission({ slug, done, needsAction, locale }: {
  slug: string; done: boolean; needsAction: boolean; locale: 'en' | 'ar';
}) {
  return (
    <a
      href={linkFor(slug)}
      target="_blank"
      rel="noopener noreferrer"
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
            Open a chat and send one message — opening the app is not enough here
          </div>
        )}
      </div>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-gold)' }}>→</span>
    </a>
  );
}

export default function CampaignPage() {
  const { isAuthenticated, isLoading: authLoading } = usePiAuth();
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
      const s = await fetch('/api/bff/campaign/status', { credentials: 'include' })
        .then((r) => r.json()).catch(() => ({}));
      setStatus(s?.data ?? null);
      if (isAuthenticated) {
        const m = await fetch('/api/bff/campaign/me', { credentials: 'include' })
          .then((r) => r.json()).catch(() => ({}));
        setMe(m?.data ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { if (!authLoading) void load(); }, [authLoading, load]);

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

  const claim = me?.claim ?? null;

  return (
    <HubSubShell
      title="Pi Reward Campaign"
      subtitle={status ? `${status.reward_pi} π · ${status.remaining} of ${status.seats} seats left` : 'Loading…'}
      loading={authLoading || loading}
    >
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
