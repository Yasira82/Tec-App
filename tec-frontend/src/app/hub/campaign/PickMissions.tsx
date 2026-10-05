'use client';

import { useState } from 'react';
import { fill } from '@/lib/i18n';

/**
 * Round 3 — three assigned apps, a report on each, reviewed by the owner
 * (KB audits/ROUND_3_DISCOVERY_DECISION_2026-10-04.md §4b, owner 2026-10-05).
 *
 *   ASSIGNED → SUBMITTED → (NEEDS_REVISION → SUBMITTED)* → APPROVED
 *
 * The service assigns the apps and decides everything; this screen shows where
 * each report stands and sends what the pioneer wrote. The report asks what
 * HAPPENED — an app that simply worked is evidence too — and "needs revision"
 * is the owner asking for more, never a rejection.
 */
export type MissionStatus = 'ASSIGNED' | 'SUBMITTED' | 'NEEDS_REVISION' | 'APPROVED';

export interface PickMission {
  app:          string;
  status?:      MissionStatus;
  arrived:      boolean;
  report:       string | null;
  had_problem?: boolean | null;
  detail?:      string | null;
  suggestion?:  string | null;
  /** The owner's note when the report needs revision. */
  review_note?: string | null;
  reported_at:  string | null;
  evidence:     string | null;
  /** When the service assigned this app — a tap saved before it is not this mission's. */
  assigned_at?: string;
}

export interface PickStrings {
  criteria: string; getApps: string; approvedOf: string;
  notOpened: string; arrived: string; submitted: string; needsRevision: string;
  ownerNote: string; approved: string;
  observedLabel: string; problemQ: string; yes: string; no: string;
  problemLabel: string; goodLabel: string; suggestion: string;
  send: string; resend: string; edit: string; failed: string;
  swap: string; swapReason: string; swapConfirm: string; cancel: string;
  problemTag: string; goodTag: string; suggested: string;
}

const TEXT_MIN = 10;
const TEXT_MAX = 1000;
const SUGGESTION_MAX = 500;

const csrfHeader = (): Record<string, string> => {
  const m = typeof document === 'undefined' ? null : document.cookie.match(/(?:^|;\s*)tec_csrf=([^;]+)/);
  return m ? { 'x-csrf-token': decodeURIComponent(m[1]) } : {};
};

async function post(path: string, body: unknown, failed: string): Promise<unknown> {
  const res = await fetch(`/api/bff/campaign/${path}`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...csrfHeader() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  // The service's own sentence: it knows WHICH rule the request broke.
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? failed);
  return data;
}

const box = {
  background: 'var(--tec-surface)', border: '1px solid var(--tec-border)',
  borderRadius: 'var(--radius-md)', padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-2)',
} as const;

const area = {
  width: '100%', marginTop: 8, padding: 10, borderRadius: 10, border: '1px solid var(--tec-border)',
  background: 'transparent', color: 'var(--tec-text-1)', font: 'inherit', fontSize: 13,
  resize: 'vertical', boxSizing: 'border-box',
} as const;

const label = { display: 'block', marginTop: 10, fontSize: 12.5, fontWeight: 700, color: 'var(--tec-text-2)' } as const;

const goldButton = (enabled: boolean) => ({
  width: '100%', marginTop: 'var(--sp-3)', padding: '11px 0', borderRadius: 12, border: 'none',
  background: 'var(--tec-gold)', color: 'var(--tec-on-gold, #1A1205)', fontWeight: 800, fontSize: 13.5,
  cursor: enabled ? 'pointer' : 'default', opacity: enabled ? 1 : 0.5, font: 'inherit',
}) as const;

const linkButton = {
  background: 'none', border: 'none', padding: 0, color: 'var(--tec-gold)',
  fontSize: 12.5, fontWeight: 700, cursor: 'pointer', font: 'inherit',
} as const;

const alert = (text?: string) =>
  text ? <div role="alert" style={{ marginTop: 8, color: 'var(--tec-red)', fontSize: 12.5 }}>{text}</div> : null;

interface Draft { observed: string; had_problem: boolean | null; detail: string; suggestion: string }

const draftOf = (m: PickMission): Draft => ({
  observed: m.report ?? '', had_problem: m.had_problem ?? null, detail: m.detail ?? '', suggestion: m.suggestion ?? '',
});

export function PickMissions({
  assigned, count, missions, swapsLeft, rewardPi, strings: s,
  nameOf, linkOf, onOpen, onChanged,
}: {
  assigned:  boolean;
  /** How many apps this round gives a pioneer — 3 by default, 6 in the owner's round. */
  count:     number;
  missions:  PickMission[];
  swapsLeft: number;
  rewardPi:  number;
  strings:   PickStrings;
  nameOf:    (slug: string) => string;
  linkOf:    (slug: string) => string;
  onOpen:    (slug: string) => void;
  onChanged: () => void | Promise<void>;
}) {
  const [busy,     setBusy]     = useState<string | null>(null);
  const [errors,   setErrors]   = useState<Record<string, string>>({});
  const [drafts,   setDrafts]   = useState<Record<string, Draft>>({});
  const [editing,  setEditing]  = useState<Record<string, boolean>>({});
  const [swapping, setSwapping] = useState<string | null>(null);
  const [reason,   setReason]   = useState('');

  const run = async (key: string, path: string, body: unknown, after?: () => void) => {
    setBusy(key);
    setErrors(({ [key]: _gone, ...rest }) => rest);
    try {
      await post(path, body, s.failed);
      after?.();
      await onChanged();
    } catch (e) {
      setErrors((x) => ({ ...x, [key]: (e as Error).message || s.failed }));
    } finally { setBusy(null); }
  };

  // What makes a report acceptable, said BEFORE anyone writes one.
  const criteria = (
    <div data-testid="criteria" style={{ ...box, background: 'var(--tec-surface-1)', fontSize: 12.5, color: 'var(--tec-text-2)', lineHeight: 1.7 }}>
      {s.criteria}
    </div>
  );

  if (!assigned) {
    return (
      <div>
        {criteria}
        <button onClick={() => { void run('assign', 'assign', {}); }} disabled={busy === 'assign'}
          style={goldButton(busy !== 'assign')}>
          {fill(s.getApps, { n: count })}
        </button>
        {alert(errors.assign)}
      </div>
    );
  }

  const approvedCount = missions.filter((m) => m.status === 'APPROVED').length;

  return (
    <div>
      {criteria}
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tec-text-1)', margin: 'var(--sp-3) 0 var(--sp-2)' }}>
        {fill(s.approvedOf, { n: approvedCount, total: missions.length, reward: rewardPi })}
      </div>

      {missions.map((m) => {
        const status = m.status ?? 'ASSIGNED';
        const d = drafts[m.app] ?? draftOf(m);
        const set = (patch: Partial<Draft>) => setDrafts((x) => ({ ...x, [m.app]: { ...d, ...patch } }));
        const canWrite = m.arrived
          && (status === 'ASSIGNED' || status === 'NEEDS_REVISION' || (status === 'SUBMITTED' && !!editing[m.app]));
        const ready = d.observed.trim().length >= TEXT_MIN && d.had_problem !== null && d.detail.trim().length >= TEXT_MIN;
        const line = status === 'APPROVED' ? s.approved
          : status === 'SUBMITTED' ? s.submitted
          : status === 'NEEDS_REVISION' ? s.needsRevision
          : m.arrived ? s.arrived : s.notOpened;
        const tone = status === 'APPROVED' ? 'var(--tec-green)' : status === 'NEEDS_REVISION' ? 'var(--tec-red)' : 'var(--tec-gold)';
        const icon = status === 'APPROVED' ? '✅' : status === 'SUBMITTED' ? '⏳' : status === 'NEEDS_REVISION' ? '✏️' : m.arrived ? '◐' : '○';
        const showSent = (status === 'SUBMITTED' && !editing[m.app]) || status === 'APPROVED';

        return (
          <div key={m.app} data-testid={`mission-${m.app}`}
            style={{ ...box, borderColor: status === 'APPROVED' ? 'rgba(34,197,94,0.3)' : 'var(--tec-border)' }}>
            <a href={linkOf(m.app)} target="_blank" rel="noopener noreferrer" onClick={() => onOpen(m.app)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
              <span style={{ fontSize: 18 }}>{icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--tec-text-1)' }}>{nameOf(m.app)}</div>
                <div style={{ fontSize: 11.5, marginTop: 2, color: tone }}>{line}</div>
              </div>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-gold)' }}>→</span>
            </a>

            {status === 'NEEDS_REVISION' && m.review_note && (
              <div data-testid={`note-${m.app}`} style={{ marginTop: 10, padding: 'var(--sp-3)', borderRadius: 10, background: 'rgba(251,180,74,0.10)', border: '1px solid var(--tec-border-gold)', fontSize: 12.5, color: 'var(--tec-text-2)', lineHeight: 1.6 }}>
                <strong>{s.ownerNote}</strong> {m.review_note}
              </div>
            )}

            {showSent && (
              <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--tec-text-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                <div>“{m.report}”</div>
                {m.detail && <div style={{ marginTop: 4 }}>{m.had_problem ? s.problemTag : s.goodTag} “{m.detail}”</div>}
                {m.suggestion && <div style={{ marginTop: 4, color: 'var(--tec-text-3)' }}>{s.suggested} “{m.suggestion}”</div>}
                {status === 'SUBMITTED' && (
                  <button onClick={() => { setEditing((x) => ({ ...x, [m.app]: true })); setDrafts((x) => ({ ...x, [m.app]: draftOf(m) })); }}
                    style={{ ...linkButton, marginTop: 6 }}>{s.edit}</button>
                )}
              </div>
            )}

            {canWrite && (
              <div style={{ marginTop: 6 }}>
                <label style={label}>{s.observedLabel}
                  <textarea value={d.observed} rows={3} aria-label={s.observedLabel}
                    onChange={(e) => set({ observed: e.target.value.slice(0, TEXT_MAX) })} style={area} />
                </label>
                <div style={label}>{s.problemQ}</div>
                <div role="radiogroup" aria-label={s.problemQ} style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  {([[true, s.yes], [false, s.no]] as const).map(([v, text]) => (
                    <button key={String(v)} role="radio" aria-checked={d.had_problem === v} onClick={() => set({ had_problem: v })}
                      style={{
                        flex: 1, padding: '9px 0', borderRadius: 10, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        border: `1px solid ${d.had_problem === v ? 'var(--tec-gold)' : 'var(--tec-border)'}`,
                        background: d.had_problem === v ? 'var(--tec-gold-dim)' : 'transparent', color: 'var(--tec-text-1)',
                      }}>
                      {text}
                    </button>
                  ))}
                </div>
                {d.had_problem !== null && (
                  <label style={label}>{d.had_problem ? s.problemLabel : s.goodLabel}
                    <textarea value={d.detail} rows={3} aria-label={d.had_problem ? s.problemLabel : s.goodLabel}
                      onChange={(e) => set({ detail: e.target.value.slice(0, TEXT_MAX) })} style={area} />
                  </label>
                )}
                <label style={label}>{s.suggestion}
                  <textarea value={d.suggestion} rows={2} aria-label={s.suggestion}
                    onChange={(e) => set({ suggestion: e.target.value.slice(0, SUGGESTION_MAX) })} style={area} />
                </label>
                <button
                  onClick={() => {
                    void run(m.app, 'report', {
                      app: m.app, observed: d.observed.trim(), had_problem: d.had_problem, detail: d.detail.trim(),
                      ...(d.suggestion.trim() ? { suggestion: d.suggestion.trim() } : {}),
                    }, () => setEditing((x) => ({ ...x, [m.app]: false })));
                  }}
                  disabled={!ready || busy === m.app}
                  style={goldButton(ready && busy !== m.app)}>
                  {status === 'ASSIGNED' ? s.send : s.resend}
                </button>
              </div>
            )}

            {/* A technical problem: swap this app for another, saying why. */}
            {status === 'ASSIGNED' && swapsLeft > 0 && (swapping === m.app ? (
              <div style={{ marginTop: 10 }}>
                <label style={label}>{s.swapReason}
                  <textarea value={reason} rows={2} aria-label={s.swapReason}
                    onChange={(e) => setReason(e.target.value.slice(0, TEXT_MAX))} style={area} />
                </label>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <button
                    onClick={() => { void run(`swap-${m.app}`, 'swap', { app: m.app, reason: reason.trim() }, () => { setSwapping(null); setReason(''); }); }}
                    disabled={reason.trim().length < TEXT_MIN || busy === `swap-${m.app}`}
                    style={{ ...goldButton(reason.trim().length >= TEXT_MIN), marginTop: 0, flex: 1 }}>
                    {s.swapConfirm}
                  </button>
                  <button onClick={() => { setSwapping(null); setReason(''); }} style={{ ...linkButton, color: 'var(--tec-text-3)', padding: '0 12px' }}>
                    {s.cancel}
                  </button>
                </div>
                {alert(errors[`swap-${m.app}`])}
              </div>
            ) : (
              <button onClick={() => { setSwapping(m.app); setReason(''); }} style={{ ...linkButton, marginTop: 10, color: 'var(--tec-text-3)' }}>
                {fill(s.swap, { left: swapsLeft })}
              </button>
            ))}
            {alert(errors[m.app])}
          </div>
        );
      })}
    </div>
  );
}
