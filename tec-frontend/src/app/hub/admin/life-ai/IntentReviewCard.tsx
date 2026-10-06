'use client';

import { useEffect, useState } from 'react';

/**
 * A2 — what the assistant was asked that it has no word for (tracker
 * tec-knowledge-base #199). The reading is the work: every excerpt is either a new
 * objective for `src/lib/ai/intent-observation.ts`'s closed set, or evidence that
 * people ask TEC for things it does not do. The card informs that change; it never
 * makes it — the closed set stays a code change with a test.
 *
 * No names: the service returns none. A half that could not be read says so —
 * an empty list would read as "nothing missing" (C-47 §10 E1).
 */

export interface IntentReviewStrings {
  title:       string;
  sub:         string;
  byObjective: string;
  unmatched:   string;
  unmatchedNone: string;
  noObjective: string;
  truncated:   string;
  unavailable: string;
}

interface Objectives { total: number; truncated?: boolean; by_objective: { objective: string | null; count: number }[] }
interface Unmatched  { matched: number; truncated?: boolean; observations: { at: string; excerpt: string | null; locale: 'en' | 'ar' | null }[] }
interface Payload    { weeks: number; objectives: Objectives | null; unmatched: Unmatched | null; unavailable: Record<string, number> }

const box  = { padding: 'var(--sp-4)', borderRadius: 14, border: '1px solid var(--tec-border)', background: 'var(--tec-surface-1)', marginBottom: 'var(--sp-4)' } as const;
const head = { fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--tec-text-3)', margin: 'var(--sp-3) 0 6px' } as const;
const row  = { display: 'flex', alignItems: 'baseline', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--tec-border)' } as const;
const day  = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function Unavailable({ s, status }: { s: IntentReviewStrings; status?: number }) {
  return (
    <div role="status" data-testid="intent-unavailable" style={{ fontSize: 12.5, color: 'var(--tec-text-3)', padding: '6px 0' }}>
      {s.unavailable}{status ? ` (HTTP ${status})` : ''}
    </div>
  );
}

export function IntentReviewCard({ strings: s }: { strings: IntentReviewStrings }) {
  const [d, setD] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/life-ai/intents', { credentials: 'include', cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.message ?? j?.error ?? `HTTP ${r.status}`);
        setD((j?.data ?? null) as Payload | null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <div style={box}><div role="alert" style={{ fontSize: 12.5, color: 'var(--tec-red)' }}>{s.unavailable}: {error}</div></div>;
  if (!d)    return <div style={box}><div style={{ fontSize: 11.5, color: 'var(--tec-text-3)' }}>…</div></div>;

  const o = d.objectives;
  const u = d.unmatched;

  return (
    <section style={box} aria-labelledby="intent-review">
      <div id="intent-review" style={{ fontSize: 14, fontWeight: 800, color: 'var(--tec-text-1)' }}>{s.title}</div>
      <div style={{ fontSize: 11.5, color: 'var(--tec-text-3)', marginTop: 2 }}>{s.sub}</div>

      <div style={head}>{s.byObjective}</div>
      {!o ? <Unavailable s={s} status={d.unavailable?.objectives} /> : (
        <>
          {o.by_objective.map((r) => (
            <div key={r.objective ?? '∅'} style={row} data-testid={`objective-${r.objective ?? 'null'}`}>
              <span style={{ flex: 1, fontSize: 13, color: r.objective === null ? 'var(--tec-gold)' : 'var(--tec-text-1)', fontWeight: r.objective === null ? 700 : 400 }}>
                {r.objective ?? s.noObjective}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tec-text-1)', fontVariantNumeric: 'tabular-nums' }}>{r.count}</span>
            </div>
          ))}
          {o.truncated && <div style={{ fontSize: 11, color: 'var(--tec-text-3)', marginTop: 4 }}>{s.truncated}</div>}
        </>
      )}

      <div style={head}>{s.unmatched}{u ? ` · ${u.matched}` : ''}</div>
      {!u ? <Unavailable s={s} status={d.unavailable?.unmatched} /> : u.observations.length === 0 ? (
        <div data-testid="unmatched-none" style={{ fontSize: 12.5, color: 'var(--tec-text-3)', padding: '6px 0' }}>{s.unmatchedNone}</div>
      ) : (
        u.observations.map((x, i) => (
          <div key={`${x.at}-${i}`} style={row} data-testid="unmatched-row">
            <span style={{ width: 52, flexShrink: 0, fontSize: 11.5, color: 'var(--tec-text-3)' }}>{day(x.at)}</span>
            <bdi dir={x.locale === 'ar' ? 'rtl' : 'auto'} style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--tec-text-1)', overflowWrap: 'anywhere' }}>
              {x.excerpt ?? '—'}
            </bdi>
          </div>
        ))
      )}
    </section>
  );
}
