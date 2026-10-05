'use client';

import { useState } from 'react';
import { fill } from '@/lib/i18n';

/**
 * Round 3 — pick 1 to 3 apps, open each, report what you found
 * (KB audits/ROUND_3_DISCOVERY_DECISION_2026-10-04.md §4).
 *
 * The size of the mission is the pioneer's choice. That choice is the round's
 * question: how many pick 1 against how many pick 3 is the answer to "is one app
 * too little, or are 24 too many?".
 *
 * Nothing here decides anything. The service checks the picks, accepts a report
 * only after the app itself reported the arrival, and works out the reward. This
 * screen shows what it says and sends what the pioneer chose.
 */
export interface PickMission {
  app:         string;
  arrived:     boolean;
  report:      string | null;
  reported_at: string | null;
  evidence:    string | null;
  /** The update they would like in this app — optional, sent with the report. */
  suggestion?: string | null;
}

export interface PickStrings {
  choose: string; start: string; change: string;
  notOpened: string; arrived: string; reported: string; edit: string;
  placeholder: string; send: string; failed: string;
  suggestion: string; suggested: string;
}

const REPORT_MIN = 10;
const REPORT_MAX = 1000;
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

const goldButton = (enabled: boolean) => ({
  width: '100%', marginTop: 'var(--sp-3)', padding: '11px 0', borderRadius: 12, border: 'none',
  background: 'var(--tec-gold)', color: 'var(--tec-on-gold, #1A1205)', fontWeight: 800, fontSize: 13.5,
  cursor: enabled ? 'pointer' : 'default', opacity: enabled ? 1 : 0.5, font: 'inherit',
}) as const;

const linkButton = {
  background: 'none', border: 'none', padding: 0, color: 'var(--tec-gold)',
  fontSize: 12.5, fontWeight: 700, cursor: 'pointer', font: 'inherit',
} as const;

export function PickMissions({
  apps, missions, rewardPi, pickMax, strings: s,
  nameOf, linkOf, onOpen, onChanged,
}: {
  apps:      string[];
  missions:  PickMission[];
  rewardPi:  number;
  pickMax:   number;
  strings:   PickStrings;
  nameOf:    (slug: string) => string;
  linkOf:    (slug: string) => string;
  onOpen:    (slug: string) => void;
  onChanged: () => void | Promise<void>;
}) {
  const picks = missions.map((m) => m.app);
  const reportedApps = missions.filter((m) => m.reported_at).map((m) => m.app);

  const [choosing, setChoosing] = useState(picks.length === 0);
  const [chosen,   setChosen]   = useState<string[]>(picks);
  const [busy,     setBusy]     = useState<string | null>(null);
  const [errors,   setErrors]   = useState<Record<string, string>>({});
  const [drafts,   setDrafts]   = useState<Record<string, string>>({});
  const [editing,  setEditing]  = useState<Record<string, boolean>>({});
  const [ideas,    setIdeas]    = useState<Record<string, string>>({});

  const fail = (key: string, e: unknown) =>
    setErrors((x) => ({ ...x, [key]: (e as Error).message || s.failed }));
  const clear = (key: string) => setErrors(({ [key]: _gone, ...rest }) => rest);

  const toggle = (slug: string) => {
    if (reportedApps.includes(slug)) return;   // a reported app stays picked
    setChosen((c) => (c.includes(slug)
      ? c.filter((a) => a !== slug)
      : c.length >= pickMax ? c : [...c, slug]));
  };

  const savePicks = async () => {
    setBusy('pick'); clear('pick');
    try {
      await post('pick', { apps: chosen }, s.failed);
      setChoosing(false);
      await onChanged();
    } catch (e) { fail('pick', e); } finally { setBusy(null); }
  };

  const sendReport = async (app: string) => {
    const text = (drafts[app] ?? '').trim();
    const idea = (ideas[app] ?? missions.find((m) => m.app === app)?.suggestion ?? '').trim();
    setBusy(app); clear(app);
    try {
      await post('report', { app, report: text, ...(idea ? { suggestion: idea } : {}) }, s.failed);
      setEditing((x) => ({ ...x, [app]: false }));
      await onChanged();
    } catch (e) { fail(app, e); } finally { setBusy(null); }
  };

  // ── Choosing ────────────────────────────────────────────────
  if (choosing) {
    return (
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tec-text-1)', marginBottom: 'var(--sp-2)' }}>
          {fill(s.choose, { n: chosen.length, max: pickMax })}
        </div>
        <div role="group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {apps.map((slug) => {
            const on = chosen.includes(slug);
            const full = !on && chosen.length >= pickMax;
            return (
              <button key={slug} role="checkbox" aria-checked={on} disabled={full || reportedApps.includes(slug)}
                onClick={() => toggle(slug)}
                style={{
                  textAlign: 'start', padding: '11px 12px', borderRadius: 10, font: 'inherit', fontSize: 13.5,
                  cursor: full ? 'default' : 'pointer', opacity: full ? 0.45 : 1,
                  border: `1px solid ${on ? 'var(--tec-gold)' : 'var(--tec-border)'}`,
                  background: on ? 'var(--tec-gold-dim)' : 'transparent', color: 'var(--tec-text-1)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                <span aria-hidden>{on ? '☑' : '☐'}</span>{nameOf(slug)}
              </button>
            );
          })}
        </div>
        <button onClick={() => { void savePicks(); }} disabled={chosen.length === 0 || busy === 'pick'}
          style={goldButton(chosen.length > 0 && busy !== 'pick')}>
          {fill(s.start, { n: chosen.length || 1, total: Number(((chosen.length || 1) * rewardPi).toFixed(8)) })}
        </button>
        {errors.pick && <div role="alert" style={{ marginTop: 8, color: 'var(--tec-red)', fontSize: 12.5 }}>{errors.pick}</div>}
      </div>
    );
  }

  // ── The picked missions ─────────────────────────────────────

  return (
    <div>
      {missions.map((m) => {
        const reported = !!m.reported_at;
        const writing = m.arrived && (!reported || editing[m.app]);
        const draft = drafts[m.app] ?? m.report ?? '';
        const okLength = draft.trim().length >= REPORT_MIN;
        return (
          <div key={m.app} data-testid={`mission-${m.app}`}
            style={{ ...box, borderColor: reported ? 'rgba(34,197,94,0.3)' : 'var(--tec-border)' }}>
            <a href={linkOf(m.app)} target="_blank" rel="noopener noreferrer" onClick={() => onOpen(m.app)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
              <span style={{ fontSize: 18 }}>{reported ? '✅' : m.arrived ? '◐' : '○'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--tec-text-1)' }}>{nameOf(m.app)}</div>
                <div style={{ fontSize: 11.5, marginTop: 2, color: reported ? 'var(--tec-green)' : 'var(--tec-gold)' }}>
                  {reported ? s.reported : m.arrived ? s.arrived : s.notOpened}
                </div>
              </div>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-gold)' }}>→</span>
            </a>

            {reported && !editing[m.app] && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12.5, color: 'var(--tec-text-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>“{m.report}”</div>
                {m.suggestion && (
                  <div style={{ fontSize: 12, color: 'var(--tec-text-3)', lineHeight: 1.6, marginTop: 4, whiteSpace: 'pre-wrap' }}>
                    {s.suggested} “{m.suggestion}”
                  </div>
                )}
                <button onClick={() => { setEditing((x) => ({ ...x, [m.app]: true })); setDrafts((d) => ({ ...d, [m.app]: m.report ?? '' })); }}
                  style={{ ...linkButton, marginTop: 6 }}>{s.edit}</button>
              </div>
            )}

            {writing && (
              <div style={{ marginTop: 10 }}>
                <textarea value={draft} rows={3} placeholder={s.placeholder} aria-label={s.placeholder}
                  onChange={(e) => setDrafts((d) => ({ ...d, [m.app]: e.target.value.slice(0, REPORT_MAX) }))}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--tec-border)', background: 'transparent', color: 'var(--tec-text-1)', font: 'inherit', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
                {/* Optional — what they would change. It replaced the lost-phone
                    question (owner, 2026-10-05): the round asks about the apps. */}
                <textarea value={ideas[m.app] ?? m.suggestion ?? ''} rows={2} placeholder={s.suggestion} aria-label={s.suggestion}
                  onChange={(e) => setIdeas((d) => ({ ...d, [m.app]: e.target.value.slice(0, SUGGESTION_MAX) }))}
                  style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 10, border: '1px solid var(--tec-border)', background: 'transparent', color: 'var(--tec-text-1)', font: 'inherit', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
                <button onClick={() => { void sendReport(m.app); }} disabled={!okLength || busy === m.app}
                  style={goldButton(okLength && busy !== m.app)}>{s.send}</button>
              </div>
            )}
            {errors[m.app] && <div role="alert" style={{ marginTop: 8, color: 'var(--tec-red)', fontSize: 12.5 }}>{errors[m.app]}</div>}
          </div>
        );
      })}

      <button onClick={() => { setChosen(picks); setChoosing(true); }} style={{ ...linkButton, marginTop: 4 }}>
        {s.change}
      </button>

    </div>
  );
}
