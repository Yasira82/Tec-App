'use client';

import { useEffect, useState } from 'react';

/**
 * Where pioneers go, and where they stop — this round (Round 3 decision,
 * KB audits/ROUND_3_DISCOVERY_DECISION_2026-10-04.md). ADMIN; identity-service
 * decides from the token. Each stage is a count of PEOPLE; the % under it is how
 * many of the stage before made it this far — the biggest drop is the question.
 */
interface Funnel {
  round: string;
  counting_since: string | null;
  stages: { viewed: number; tapped: number; arrived: number; qualified: number; claimed: number; paid: number };
  mode?: 'all' | 'pick';
  per_app: { app: string; tapped: number; arrived: number; picked?: number; reported?: number }[];
  /** Round 3: how many chose 1, 2 or 3 apps — the round's question. */
  picks?: { one: number; two: number; three: number };
  stop_reasons: { reason: string; label: string; count: number }[];
  notes: { reason: string; note: string; at: string }[];
}

const STAGES: { key: keyof Funnel['stages']; label: string }[] = [
  { key: 'viewed',    label: 'Opened the page' },
  { key: 'tapped',    label: 'Tapped an app' },
  { key: 'arrived',   label: 'Arrived (app confirmed)' },
  { key: 'qualified', label: 'Finished every mission' },
  { key: 'claimed',   label: 'Took a seat' },
  { key: 'paid',      label: 'Paid' },
];

const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : '—');
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

interface Report { owner: string; app: string; report: string | null; suggestion?: string | null; reported_at: string | null }

export function FunnelCard() {
  const [f, setF] = useState<Funnel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    fetch('/api/admin/campaign/funnel', { credentials: 'include', cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.message ?? d?.error ?? `HTTP ${r.status}`);
        setF(d?.data ?? null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  // Round 3's reports — what pioneers found, read before a payout goes out.
  useEffect(() => {
    if (f?.mode !== 'pick') return;
    fetch('/api/admin/campaign/reports', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json().catch(() => ({})))
      .then((d) => setReports(Array.isArray(d?.data?.reports) ? d.data.reports : []))
      .catch(() => setReports([]));
  }, [f?.mode]);

  const box = { padding: 'var(--sp-4)', borderRadius: 14, border: '1px solid var(--tec-border)', background: 'var(--tec-surface-1)', marginBottom: 'var(--sp-4)' } as const;
  const head = { fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--tec-text-3)', margin: 'var(--sp-3) 0 6px' } as const;

  if (error) return <div style={box}><div role="alert" style={{ fontSize: 12.5, color: 'var(--tec-red)' }}>Funnel unavailable: {error}</div></div>;
  if (!f) return null;

  return (
    <section aria-label="Campaign funnel" style={box}>
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--tec-text-1)' }}>Funnel — this round</div>
      <div style={{ fontSize: 11.5, color: 'var(--tec-text-3)', marginTop: 2 }}>
        {f.round === 'all' ? 'All rounds' : `Since ${day(f.round)}`}
        {f.counting_since ? ` · “opened” and “finished” counted since ${day(f.counting_since)}` : ' · “opened” and “finished” start counting now'}
      </div>

      <div style={{ marginTop: 'var(--sp-3)' }}>
        {STAGES.map((s, i) => {
          const n = f.stages[s.key];
          const prev = i > 0 ? f.stages[STAGES[i - 1].key] : null;
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--tec-border)' }}>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--tec-text-2)' }}>{s.label}</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--tec-gold)' }}>{n}</span>
              <span style={{ width: 44, textAlign: 'end', fontSize: 11.5, color: 'var(--tec-text-3)' }}>{prev === null ? '' : pct(n, prev)}</span>
            </div>
          );
        })}
      </div>

      {f.per_app.length > 0 && (
        <>
          <div style={head}>{f.mode === 'pick' ? 'Per app — picked · reported · tapped → arrived' : 'Per app — tapped → arrived'}</div>
          {f.per_app.map((a) => (
            <div key={a.app} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--tec-text-2)', padding: '3px 0' }}>
              <span style={{ flex: 1 }}>{a.app}</span>
              {f.mode === 'pick' && <span>{a.picked ?? 0} · {a.reported ?? 0} ·</span>}
              <span>{a.tapped} → {a.arrived}</span>
              <span style={{ width: 44, textAlign: 'end', color: a.tapped > 0 && a.arrived / a.tapped < 0.7 ? 'var(--tec-red)' : 'var(--tec-text-3)' }}>{pct(a.arrived, a.tapped)}</span>
            </div>
          ))}
        </>
      )}

      {f.picks && (
        <>
          <div style={head}>How many apps people chose</div>
          <div data-testid="pick-split" style={{ display: 'flex', gap: 8 }}>
            {([['1 app', f.picks.one], ['2 apps', f.picks.two], ['3 apps', f.picks.three]] as const).map(([label, n]) => (
              <div key={label} style={{ flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 10, border: '1px solid var(--tec-border)' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--tec-gold)' }}>{n}</div>
                <div style={{ fontSize: 11.5, color: 'var(--tec-text-3)' }}>{label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={head}>Why people stopped (their words)</div>
      {f.stop_reasons.every((r) => r.count === 0) ? (
        <div style={{ fontSize: 12.5, color: 'var(--tec-text-3)' }}>No answers yet.</div>
      ) : f.stop_reasons.map((r) => (
        <div key={r.reason} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--tec-text-2)', padding: '3px 0' }}>
          <span style={{ flex: 1 }}>{r.label}</span><span style={{ fontWeight: 700 }}>{r.count}</span>
        </div>
      ))}
      {f.notes.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {f.notes.map((n, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--tec-text-2)', padding: '4px 0', lineHeight: 1.5 }}>
              “{n.note}” <span style={{ color: 'var(--tec-text-4)' }}>— {n.reason} · {day(n.at)}</span>
            </div>
          ))}
        </div>
      )}

      {f.mode === 'pick' && (
        <>
          <div style={head}>Reports — what pioneers found, and what they would change ({reports.length})</div>
          {reports.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--tec-text-3)' }}>No reports yet.</div>
          ) : reports.map((r, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--tec-text-2)', padding: '5px 0', lineHeight: 1.5, borderBottom: '1px solid var(--tec-border)' }}>
              <span style={{ fontWeight: 700 }}>{r.app}</span> — “{r.report}”{' '}
              <span style={{ color: 'var(--tec-text-4)' }}>@{r.owner}{r.reported_at ? ` · ${day(r.reported_at)}` : ''}</span>
              {r.suggestion && (
                <div style={{ color: 'var(--tec-gold)', marginTop: 2 }}>Suggestion: “{r.suggestion}”</div>
              )}
            </div>
          ))}
        </>
      )}
    </section>
  );
}
