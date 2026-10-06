'use client';

import { useEffect, useState } from 'react';

/**
 * The two numbers that gate every Life/AI expansion (M1, tracker
 * tec-knowledge-base #199): consent coverage (C-106 §8) and assistant usage.
 *
 * Counts only — the services return no name and this card asks for none. A half
 * that could not be read says so; it never renders as 0 (C-47 §10 E1). The strings
 * come in as a prop (the page hands it `t.hub.adminLifeAi`) so the card renders
 * without a locale provider in tests, like StopReasonCard.
 */

export interface LifeAiStrings {
  consentTitle: string;
  consentSub:   string;
  anyGrant:     string;
  perCategory:  string;
  usageTitle:   string;
  usageSub:     string;
  messages:     string;
  people:       string;
  total:        string;
  unavailable:  string;
  categories:   Record<string, string>;
}

interface Consent {
  users_with_any: number;
  per_category:   Record<string, number>;
  categories:     string[];
}
interface Usage {
  weeks:   number;
  since:   string;
  by_week: { week: string; start: string; messages: number; users: number }[];
  totals:  { messages: number; users: number };
}
interface Payload {
  consent:     Consent | null;
  usage:       Usage | null;
  unavailable: Record<string, number>;
}

const box  = { padding: 'var(--sp-4)', borderRadius: 14, border: '1px solid var(--tec-border)', background: 'var(--tec-surface-1)', marginBottom: 'var(--sp-4)' } as const;
const head = { fontSize: 14, fontWeight: 800, color: 'var(--tec-text-1)' } as const;
const sub  = { fontSize: 11.5, color: 'var(--tec-text-3)', marginTop: 2 } as const;
const row  = { display: 'flex', alignItems: 'baseline', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--tec-border)' } as const;
const big  = { fontSize: 26, fontWeight: 800, color: 'var(--tec-gold)', lineHeight: 1.1 } as const;

const weekLabel = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function Unavailable({ s, status }: { s: LifeAiStrings; status?: number }) {
  return (
    <div role="status" data-testid="life-ai-unavailable" style={{ fontSize: 12.5, color: 'var(--tec-text-3)', padding: 'var(--sp-3) 0' }}>
      {s.unavailable}{status ? ` (HTTP ${status})` : ''}
    </div>
  );
}

export function LifeAiCard({ strings: s }: { strings: LifeAiStrings }) {
  const [d, setD] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/life-ai', { credentials: 'include', cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.message ?? j?.error ?? `HTTP ${r.status}`);
        setD((j?.data ?? null) as Payload | null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <div style={box}><div role="alert" style={{ fontSize: 12.5, color: 'var(--tec-red)' }}>{s.unavailable}: {error}</div></div>;
  if (!d)    return <div style={box}><div style={sub}>…</div></div>;

  const consent = d.consent;
  const usage   = d.usage;
  const maxMsgs = usage ? Math.max(1, ...usage.by_week.map((w) => w.messages)) : 1;

  return (
    <>
      <section style={box} aria-labelledby="life-ai-consent">
        <div id="life-ai-consent" style={head}>{s.consentTitle}</div>
        <div style={sub}>{s.consentSub}</div>
        {!consent ? <Unavailable s={s} status={d.unavailable?.consent} /> : (
          <div style={{ marginTop: 'var(--sp-3)' }}>
            <div style={big} data-testid="consent-any">{consent.users_with_any}</div>
            <div style={{ fontSize: 12, color: 'var(--tec-text-2)', marginBottom: 'var(--sp-3)' }}>{s.anyGrant}</div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--tec-text-3)', margin: '6px 0' }}>{s.perCategory}</div>
            {consent.categories.map((c) => (
              <div key={c} style={row} data-testid={`consent-${c}`}>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--tec-text-1)' }}>{s.categories[c] ?? c}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tec-text-1)', fontVariantNumeric: 'tabular-nums' }}>{consent.per_category[c] ?? 0}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={box} aria-labelledby="life-ai-usage">
        <div id="life-ai-usage" style={head}>{s.usageTitle}</div>
        <div style={sub}>{s.usageSub}</div>
        {!usage ? <Unavailable s={s} status={d.unavailable?.usage} /> : (
          <div style={{ marginTop: 'var(--sp-3)' }}>
            <div style={{ display: 'flex', gap: 'var(--sp-5)', marginBottom: 'var(--sp-3)' }}>
              <div>
                <div style={big} data-testid="usage-messages">{usage.totals.messages}</div>
                <div style={{ fontSize: 12, color: 'var(--tec-text-2)' }}>{s.messages} · {s.total}</div>
              </div>
              <div>
                <div style={big} data-testid="usage-people">{usage.totals.users}</div>
                <div style={{ fontSize: 12, color: 'var(--tec-text-2)' }}>{s.people} · {s.total}</div>
              </div>
            </div>
            {usage.by_week.map((w) => (
              <div key={w.week} style={row} data-testid={`usage-${w.week}`}>
                <span style={{ width: 56, fontSize: 12, color: 'var(--tec-text-3)' }}>{weekLabel(w.start)}</span>
                <span style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--tec-surface-2)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${Math.round((w.messages / maxMsgs) * 100)}%`, background: 'var(--tec-gold)' }} />
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--tec-text-1)', fontVariantNumeric: 'tabular-nums', minWidth: 72, textAlign: 'end' }}>
                  {w.messages} · {w.users}
                </span>
              </div>
            ))}
            <div style={{ fontSize: 11, color: 'var(--tec-text-3)', marginTop: 6 }}>{s.messages} · {s.people}</div>
          </div>
        )}
      </section>
    </>
  );
}
