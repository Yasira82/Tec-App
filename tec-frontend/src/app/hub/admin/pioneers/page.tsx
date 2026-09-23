'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePiAuth }   from '@/lib-client/hooks/usePiAuth';
import { HubSubShell } from '@/components/hub';
import { Icon }        from '@/components/ui/Icon';

/**
 * How close each app is to Pi's `.pi` claim threshold.
 *
 * Pi refuses a domain claim until the connected app has "at least 5 unique
 * KYC'd approved Pioneers engage with it". Twenty-four domains were won at
 * auction and paid for, and only `tec.pi` has been accepted — so the campaign's
 * real job is to clear this bar twenty-three more times.
 *
 * The screen exists because the number was unreadable from a phone: the data
 * was there, behind an admin token, and a campaign you cannot see the state of
 * is a campaign worked blind.
 *
 * `role === 'admin'` hides it; `tec-identity-service` enforces it.
 */

interface AppRow {
  app:          string;
  /**
   * Pi has already ACCEPTED this domain — `tec.pi` today.
   *
   * It kept appearing as "needs 5 more", which overstated the job by one app
   * and five pioneers on every headline. A dashboard that inflates the work
   * left is not being careful; it is wrong in the direction that teaches you to
   * stop reading it.
   */
  claimed?:     boolean;
  /**
   * Confirmed BY THE APP — now the headline, and the only number here that can
   * move.
   *
   * `verified` used to be it, and could not work: it reads TEC's own
   * document-KYC register, a separate flow almost nobody completes, while Pi
   * checks its own records which this platform cannot read. So it sat at 0
   * while eleven pioneers worked through the apps, and every figure derived
   * from it was frozen at maximum.
   *
   * `arrived` is not Pi's number either — it is a SUPERSET of it. That gives
   * the one direction worth having: below the threshold is reliable, at or
   * above it is not a confirmation from Pi.
   */
  arrived?:     number;
  /** Taps this app never confirmed — the measurement error, made visible. */
  unconfirmed?: number;
  openers:      number;
  threshold:    number;
  still_needed: number;
}

interface Coverage {
  threshold:          number;
  total_pioneers:     number;
  apps_claimed?:      number;
  apps_short:         number;
  total_still_needed: number;
  note:               string;
  apps:               AppRow[];
}

/**
 * What came back from re-asking commerce for the Founding gifts.
 *
 * `granted` is the figure worth reading and the reason the whole thing exists:
 * the service asks COMMERCE rather than consulting a flag of its own, so a
 * non-zero `granted` is not bookkeeping — it is the number of pioneers who had
 * earned six months of PRO and never received it.
 *
 * `already` is the healthy case and will be nearly everything. The two must
 * stay distinguishable: "97 delivered" and "97 already there, 3 recovered"
 * read identically, and only the second says an outage cost somebody something.
 */
interface Regrant {
  checked:       number;
  granted:       number;
  already:       number;
  failed:        number;
  /**
   * Never asked, because this service was not told where commerce is. Counted
   * apart from `failed`: "commerce refused" and "commerce was never called" have
   * different fixes, and one number made them look the same. Optional so an
   * older identity-service that does not send it still renders.
   */
  skipped?:      number;
  /** `false` means every gift since launch was silently skipped. */
  commerce_configured?: boolean;
  /** Resolved by asking auth for the id, because the quest predates `user_id`. */
  by_lookup:     number;
  /** Named, never silently skipped — a recovery that hides what it could not
   *  recover is not a recovery. */
  unresolvable:  string[];
}

function Bar({ value, of }: { value: number; of: number }) {
  const pct = Math.min(100, Math.round((value / of) * 100));
  const done = value >= of;
  return (
    <div style={{
      height: 6, borderRadius: 999, background: 'var(--tec-fill-soft)',
      overflow: 'hidden', marginTop: 6,
    }}>
      <div style={{
        width: `${pct}%`, height: '100%', borderRadius: 999,
        background: done ? 'var(--tec-green)' : 'var(--tec-gold)',
        transition: 'width .3s',
      }} />
    </div>
  );
}

function Row({ row }: { row: AppRow }) {
  const arrived = row.arrived ?? 0;
  const done    = row.still_needed === 0;
  const claimed = row.claimed === true;

  return (
    <div style={{
      background: 'var(--tec-surface)', border: '1px solid var(--tec-border)',
      borderRadius: 'var(--radius-md)', padding: 'var(--sp-3) var(--sp-4)',
      marginBottom: 'var(--sp-2)',
      // A claimed domain is still listed — it is a live app and its numbers are
      // still worth seeing — but it stops competing for attention with the rows
      // that are actually asking for something.
      opacity: claimed ? 0.55 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span dir="ltr" style={{
          fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--tec-text-1)',
          fontFamily: 'var(--font-mono)', flex: 1, minWidth: 0,
        }}>
          {row.app}.pi
        </span>

        {claimed ? (
          <span style={{
            fontSize: 11, fontWeight: 800, color: 'var(--tec-green)',
            border: '1px solid rgba(34,197,94,0.35)', borderRadius: 999,
            padding: '2px 9px', whiteSpace: 'nowrap',
          }}>
            ✓ claimed
          </span>
        ) : (
          <>
            {/* `arrived` is the headline now. See the AppRow doc for why the
                verified count could not be. */}
            <span dir="ltr" style={{
              fontSize: 'var(--text-sm)', fontWeight: 800,
              color: done ? 'var(--tec-green)' : 'var(--tec-gold)',
            }}>
              {arrived} / {row.threshold}
            </span>
            <span dir="ltr" style={{ fontSize: 11, color: 'var(--tec-text-3)', minWidth: 62, textAlign: 'end' }}>
              {row.openers} opened
            </span>
          </>
        )}
      </div>

      {!claimed && <Bar value={arrived} of={row.threshold} />}

      <div style={{
        marginTop: 6, display: 'flex', alignItems: 'baseline',
        gap: 10, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--tec-text-3)',
      }}>
        {claimed && <span>already accepted by Pi — nothing outstanding</span>}
        {!claimed && !done && <span>needs {row.still_needed} more arrivals</span>}

        {/* The gap between taps and confirmed arrivals: engagement the Hub
            recorded that nothing can prove landed. Reads as every opener until
            the fleet deploys the reporter, which is honest. */}
        {!claimed && typeof row.unconfirmed === 'number' && row.unconfirmed > 0 && (
          <span dir="ltr">{row.unconfirmed} unconfirmed</span>
        )}
      </div>
    </div>
  );
}

export default function AdminPioneersPage() {
  const { user, isLoading: authLoading } = usePiAuth();
  const isAdmin = (user as { role?: string } | null)?.role === 'admin';

  const [data,    setData]    = useState<Coverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied,  setDenied]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const [regranting,   setRegranting]   = useState(false);
  const [regrant,      setRegrant]      = useState<Regrant | null>(null);
  const [regrantError, setRegrantError] = useState<string | null>(null);

  /**
   * No confirmation step, deliberately — and the reason is the same one that
   * kept a confirmation phrase on `/reset`: the question is what happens when
   * somebody runs it by accident. Here, nothing. Commerce dedupes by the note,
   * so a second run returns ALREADY_GRANTED for every pioneer and changes no
   * subscription. A dialog guarding a no-op only teaches people to dismiss
   * dialogs.
   */
  const runRegrant = useCallback(async () => {
    setRegranting(true); setRegrantError(null); setRegrant(null);
    try {
      // `/api/admin` is in middleware's CSRF_PROTECTED list. A same-origin POST
      // would also pass on the Origin branch, but leaning on that would make
      // this the one state-changing call in the Hub that carries no token —
      // and the branch it relies on is the fallback, not the rule.
      const csrf = document.cookie.split('; ')
        .find((r) => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
      const res  = await fetch('/api/admin/pioneers/regrant', {
        method:      'POST',
        credentials: 'include',
        headers:     csrf ? { 'x-csrf-token': decodeURIComponent(csrf) } : {},
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      setRegrant((json?.data ?? null) as Regrant | null);
    } catch (e) {
      setRegrantError((e as Error).message);
    } finally {
      setRegranting(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/admin/pioneers/coverage', { credentials: 'include' });
      if (res.status === 401 || res.status === 403) { setDenied(true); return; }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      setData(json?.data ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!authLoading) void load(); }, [authLoading, load]);

  return (
    <HubSubShell
      title="Pioneer coverage"
      subtitle="Admin — progress toward Pi's .pi claim threshold"
      loading={authLoading || loading}
      // Reached from Profile's admin row. Defaulting to /hub walked past the
      // page you came from, so getting back meant navigating in again.
      backTo="/hub/profile"
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
      ) : error ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: 'var(--sp-4)',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--radius-md)', color: 'var(--tec-red)', fontSize: 'var(--text-sm)',
        }}>
          <Icon name="alert" size={16} color="var(--tec-red)" /> {error}
        </div>
      ) : data ? (
        <>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--sp-2)',
            marginBottom: 'var(--sp-4)',
          }}>
            {[
              { label: 'Apps short',   value: data.apps_short,         tone: 'var(--tec-gold)' },
              { label: 'Still needed', value: data.total_still_needed, tone: 'var(--tec-red)'  },
              // Was "Verified" — TEC's own KYC, which sat at 0 beside eleven
              // active pioneers and told you nothing about the campaign. The
              // domains already accepted are the number that means progress.
              { label: 'Claimed',      value: data.apps_claimed ?? 0,  tone: 'var(--tec-green)' },
            ].map((s) => (
              <div key={s.label} style={{
                background: 'var(--tec-surface)', border: '1px solid var(--tec-border)',
                borderRadius: 'var(--radius-md)', padding: 'var(--sp-3)', textAlign: 'center',
              }}>
                <div dir="ltr" style={{ fontSize: 22, fontWeight: 800, color: s.tone }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--tec-text-3)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* The caveat travels WITH the numbers, not in a doc nobody opens.
              A reader who mistakes this count for Pi's verdict will declare a
              domain ready and then watch the claim get refused. */}
          <div style={{
            padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-4)',
            background: 'var(--tec-fill-softer)', border: '1px solid var(--tec-border)',
            borderRadius: 'var(--radius-md)', fontSize: 11.5,
            color: 'var(--tec-text-3)', lineHeight: 1.6,
          }}>
            {data.note}
          </div>

          {data.apps.map((row) => <Row key={row.app} row={row} />)}

          {/* ── Founding gift recovery ───────────────────────────────────────
              Below the rows on purpose. It is a repair, run rarely, and it
              WRITES — putting it above the data would make the first thing
              your thumb reaches on a phone the one control here that changes
              somebody's subscription. */}
          <div style={{
            marginTop: 'var(--sp-6)', padding: 'var(--sp-4)',
            background: 'var(--tec-surface)', border: '1px solid var(--tec-border)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{
              fontSize: 'var(--text-sm)', fontWeight: 700,
              color: 'var(--tec-text-1)', marginBottom: 4,
            }}>
              Founding gifts
            </div>
            <div style={{
              fontSize: 11.5, color: 'var(--tec-text-3)',
              lineHeight: 1.6, marginBottom: 'var(--sp-3)',
            }}>
              Re-asks commerce for the 6-month PRO owed to every Founding Pioneer.
              A gift that already landed is left alone, so this is safe to run at
              any time — and anything it reports as <b>recovered</b> is a gift that
              had been lost.
            </div>

            <button
              onClick={() => void runRegrant()}
              disabled={regranting}
              style={{
                width: '100%', padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--tec-border)', background: 'var(--tec-fill-soft)',
                color: 'var(--tec-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700,
                cursor: regranting ? 'default' : 'pointer', opacity: regranting ? 0.6 : 1,
              }}
            >
              {regranting ? 'Checking every pioneer…' : 'Re-send Founding gifts'}
            </button>

            {regrantError && (
              <div style={{
                marginTop: 'var(--sp-3)', display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 'var(--text-sm)', color: 'var(--tec-red)',
              }}>
                <Icon name="alert" size={16} color="var(--tec-red)" /> {regrantError}
              </div>
            )}

            {regrant && (() => {
              // "Nothing was missing" used to follow from `granted === 0` alone
              // — so when EVERY gift failed or was skipped, this screen said, in
              // green, that all was well. The one button built to catch a
              // missing PRO was reassuring its owner at the exact moment the
              // PRO was missing for everyone.
              const skipped   = regrant.skipped ?? 0;
              const notLanded = regrant.failed + skipped + regrant.unresolvable.length;
              const headline  = regrant.commerce_configured === false
                ? { text: 'Gifts are NOT being sent — COMMERCE_SERVICE_URL is unset on identity-service', color: 'var(--tec-red)' }
                : notLanded > 0
                  ? { text: `${notLanded} still without their PRO`, color: 'var(--tec-red)' }
                  : regrant.granted > 0
                    ? { text: `${regrant.granted} recovered`, color: 'var(--tec-gold)' }
                    : { text: 'Nothing was missing', color: 'var(--tec-green)' };
              return (
              <div style={{ marginTop: 'var(--sp-3)' }}>
                {/* The headline answers ONE question — does every Founding
                    member have the PRO they were promised? — and only says yes
                    when nothing failed, nothing was skipped and nobody is
                    unresolvable. Zero recovered is still the good answer, but
                    only in that case. */}
                <div dir="ltr" style={{
                  fontSize: 'var(--text-sm)', fontWeight: 700, color: headline.color,
                }}>
                  {headline.text}
                </div>

                <div dir="ltr" style={{
                  marginTop: 4, fontSize: 11.5, color: 'var(--tec-text-3)', lineHeight: 1.7,
                }}>
                  {regrant.checked} checked · {regrant.already} already held
                  {regrant.granted > 0 && notLanded > 0 && <> · {regrant.granted} recovered</>}
                  {regrant.failed  > 0 && <> · <b style={{ color: 'var(--tec-red)' }}>{regrant.failed} failed</b></>}
                  {skipped > 0 && <> · <b style={{ color: 'var(--tec-red)' }}>{skipped} skipped</b></>}
                  {/* An id inferred from a username is a fair risk for a gift
                      and not the same fact as a recorded one, so it is counted
                      apart rather than folded into the total. */}
                  {regrant.by_lookup > 0 && <> · {regrant.by_lookup} by username lookup</>}
                </div>

                {regrant.unresolvable.length > 0 && (
                  <div style={{
                    marginTop: 'var(--sp-2)', padding: 'var(--sp-2) var(--sp-3)',
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 'var(--radius-sm)', fontSize: 11.5, color: 'var(--tec-text-2)',
                    lineHeight: 1.7,
                  }}>
                    No account could be resolved for{' '}
                    <b dir="ltr">{regrant.unresolvable.join(', ')}</b> — they hold a
                    Founding number and still have no gift. Named rather than
                    skipped, because they are the ones that need a human.
                  </div>
                )}
              </div>
              );
            })()}
          </div>
        </>
      ) : null}
    </HubSubShell>
  );
}
