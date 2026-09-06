'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePiAuth }   from '@/lib-client/hooks/usePiAuth';
import { HubSubShell } from '@/components/hub';

/**
 * What actually happens when the campaign is used, in plain text.
 *
 * ── Why this page exists ────────────────────────────────────────────────────
 * Every campaign bug this week was diagnosed from ONE line of a Vercel log,
 * after an hour of screenshots of symptoms. The screenshots showed what a
 * screen looked like; the log line said what the server answered, and that is
 * the only thing either of us can act on.
 *
 * A phone has no console and no log viewer. So this page is the log viewer:
 * it runs each step of the campaign path from the browser that has the
 * problem, with the cookies that have the problem, and prints the HTTP status
 * and the RAW body of each answer.
 *
 * ── What it deliberately does ──────────────────────────────────────────────
 * Nothing is interpreted. No "✅ looks fine". A summary is a judgement, and a
 * wrong judgement here is exactly how an hour gets spent looking in the wrong
 * place — the status code and the body are the facts, and they go on screen
 * unedited.
 *
 * Every probe is a GET. This page reads; it never claims a seat, marks
 * anything paid, or sends Pi. A diagnostic that changes state is a diagnostic
 * nobody dares run twice.
 *
 * The first probe is the BUILD, because "did the fix deploy?" answers a large
 * share of "it is still broken" and costs one line to check.
 */

interface Probe {
  name:   string;
  path:   string;
  status: number | null;
  ms:     number;
  body:   string;
  error:  string | null;
}

const MAX_BODY = 1200;

export default function CampaignDiagnosePage() {
  const { user, isLoading: authLoading } = usePiAuth();
  const isAdmin = (user as { role?: string } | null)?.role === 'admin';

  const [probes,  setProbes]  = useState<Probe[]>([]);
  const [running, setRunning] = useState(false);
  const [copied,  setCopied]  = useState(false);

  const run = useCallback(async () => {
    setRunning(true); setProbes([]);

    // Ordered the way the path is walked, so reading top to bottom follows what
    // a pioneer does: is this build current → is the campaign open → what does
    // it think of me → (admin) can it pay → what is in the queue.
    const steps: Array<[string, string]> = [
      ['Build serving this page', '/api/admin/campaign/build'],
      ['Campaign status',         '/api/bff/campaign/status'],
      ['My progress and claim',   '/api/bff/campaign/me'],
      ['Payout wallet',           '/api/admin/campaign/payout-wallet'],
      ['Every claim',             '/api/admin/campaign/claims?status=ALL'],
    ];

    const out: Probe[] = [];
    for (const [name, path] of steps) {
      const t0 = Date.now();
      try {
        const res  = await fetch(path, { credentials: 'include', cache: 'no-store' });
        const text = await res.text();
        out.push({
          name, path, status: res.status, ms: Date.now() - t0,
          // Pretty-printed when it parses, raw when it does not — an HTML error
          // page is itself the answer, and reformatting it into "invalid JSON"
          // would throw away the only clue it carries.
          body: prettify(text), error: null,
        });
      } catch (e) {
        // The request never completed. Not a status, and it must not be shown
        // as one.
        out.push({
          name, path, status: null, ms: Date.now() - t0, body: '',
          error: (e as Error).message,
        });
      }
      setProbes([...out]);
    }
    setRunning(false);
  }, []);

  useEffect(() => { if (!authLoading) void run(); }, [authLoading, run]);

  const report = () => [
    `TEC campaign diagnostics — ${new Date().toISOString()}`,
    `admin: ${isAdmin ? 'yes' : 'no'}`,
    '',
    ...probes.map((p) => [
      `── ${p.name}  [${p.path}]`,
      p.error ? `REQUEST FAILED: ${p.error}` : `HTTP ${p.status}  (${p.ms}ms)`,
      p.body,
      '',
    ].join('\n')),
  ].join('\n');

  const copy = () => {
    navigator.clipboard.writeText(report()).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    }).catch(() => { /* a failed copy must not blank the page it was copying */ });
  };

  return (
    <HubSubShell
      title="Campaign diagnostics"
      subtitle="Admin — what the server actually answers"
      loading={authLoading}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--sp-4)', flexWrap: 'wrap' }}>
        <button
          onClick={() => { void run(); }} disabled={running}
          style={{
            padding: '10px 18px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'var(--tec-gold)', color: '#1a1200', fontWeight: 800,
            fontSize: 13, font: 'inherit', cursor: running ? 'default' : 'pointer',
            opacity: running ? 0.6 : 1,
          }}
        >
          {running ? 'Running…' : 'Run again'}
        </button>
        <button
          onClick={copy} disabled={running || probes.length === 0}
          style={{
            padding: '10px 16px', borderRadius: 'var(--radius-sm)',
            background: 'transparent', border: '1px solid var(--tec-border-gold)',
            color: 'var(--tec-gold)', fontWeight: 700, fontSize: 13,
            font: 'inherit', cursor: 'pointer',
          }}
        >
          {copied ? 'Copied' : 'Copy everything'}
        </button>
      </div>

      <p style={{ margin: '0 0 var(--sp-4)', fontSize: 12, lineHeight: 1.6, color: 'var(--tec-text-3)' }}>
        Every check below is read-only — nothing here claims a seat, marks a payout, or
        sends Pi. Copy the whole thing and send it: the status code and the body say what
        a screenshot of the screen cannot.
      </p>

      {probes.map((p) => (
        <div
          key={p.path}
          style={{
            background: 'var(--tec-surface)', borderRadius: 'var(--radius-md)',
            padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-3)',
            border: `1px solid ${tone(p)}`,
          }}
        >
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            gap: 8, flexWrap: 'wrap',
          }}>
            <strong style={{ fontSize: 13, color: 'var(--tec-text-1)' }}>{p.name}</strong>
            <span dir="ltr" style={{ fontSize: 12, fontWeight: 800, color: tone(p) }}>
              {p.error ? 'no response' : `HTTP ${p.status}`}
              <span style={{ color: 'var(--tec-text-3)', fontWeight: 400 }}> · {p.ms}ms</span>
            </span>
          </div>
          <div dir="ltr" style={{
            marginTop: 2, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--tec-text-3)',
          }}>
            {p.path}
          </div>
          <pre dir="ltr" style={{
            margin: '8px 0 0', fontSize: 11, lineHeight: 1.5,
            fontFamily: 'var(--font-mono)', color: 'var(--tec-text-2)',
            whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
            background: 'var(--tec-fill-soft)', borderRadius: 'var(--radius-sm)',
            padding: '8px 10px', maxHeight: 320, overflowY: 'auto',
          }}>
            {p.error ? `REQUEST FAILED: ${p.error}` : p.body || '(empty body)'}
          </pre>
        </div>
      ))}

      {!running && probes.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--tec-text-3)' }}>Nothing ran.</p>
      )}
    </HubSubShell>
  );
}

/**
 * A 401 or 403 on the two admin probes is NOT painted as a failure — a
 * non-admin session refused there is the system working, and colouring it red
 * would send somebody chasing a permission that is behaving correctly.
 */
const tone = (p: Probe): string => {
  if (p.error) return 'var(--tec-red)';
  if (p.status === null) return 'var(--tec-red)';
  if (p.status < 300) return 'var(--tec-green)';
  if (p.status === 401 || p.status === 403) return 'var(--tec-text-3)';
  return 'var(--tec-red)';
};

const prettify = (text: string): string => {
  let out = text;
  try {
    out = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    // Not JSON. An HTML error page, a proxy's plain-text refusal — whatever it
    // is, it is the answer, and it goes on screen as it arrived.
  }
  return out.length > MAX_BODY ? `${out.slice(0, MAX_BODY)}\n… (${out.length - MAX_BODY} more characters)` : out;
};
