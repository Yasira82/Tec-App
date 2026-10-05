'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Round 3's review queue — the owner reads every report and either approves it
 * or asks for more (KB ROUND_3_DISCOVERY_DECISION §4b, owner 2026-10-05).
 *
 * The bar is SPECIFICITY, not sentiment: an app that simply worked, described
 * specifically, is approved like a bug found. "Needs revision" sends a note the
 * pioneer reads and can answer — it is never a rejection. Swaps are listed too:
 * each says which app did not work for someone, and why.
 */
export interface ReviewReport {
  id: string; owner: string; app: string;
  status: 'ASSIGNED' | 'SUBMITTED' | 'NEEDS_REVISION' | 'APPROVED' | 'SWAPPED';
  report: string | null; had_problem: boolean | null; detail: string | null; suggestion: string | null;
  review_note: string | null; revisions: number; swap_reason: string | null; reported_at: string | null;
  /**
   * `partial` — the app itself saw this Pioneer sign in with Pi there.
   * `declared` — opened from the campaign page, but the app never said so.
   * A report opens on the tap (owner, 2026-10-05); this is what the reviewer
   * weighs instead of a gate that kept missions shut.
   */
  evidence?: string | null;
}

const STATUS_LABEL: Record<ReviewReport['status'], string> = {
  ASSIGNED: 'Assigned', SUBMITTED: 'Waiting for review', NEEDS_REVISION: 'Revision asked',
  APPROVED: 'Approved', SWAPPED: 'Swapped (technical problem)',
};

const head = { fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--tec-text-3)', margin: 'var(--sp-3) 0 6px' } as const;
const small = { padding: '7px 14px', borderRadius: 8, font: 'inherit', fontSize: 12, fontWeight: 800, cursor: 'pointer' } as const;

export function ReportReview() {
  const [reports, setReports] = useState<ReviewReport[]>([]);
  const [busy, setBusy]       = useState<string | null>(null);
  const [revising, setRevising] = useState<string | null>(null);
  const [note, setNote]       = useState('');
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/admin/campaign/reports', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json().catch(() => ({})))
      .then((d) => setReports(Array.isArray(d?.data?.reports) ? d.data.reports : []))
      .catch(() => setReports([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const review = async (id: string, action: 'approve' | 'revise') => {
    setBusy(id); setError(null);
    try {
      const res = await fetch(`/api/admin/campaign/reports/${id}/review`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(action === 'revise' ? { note: note.trim() } : {}) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.message ?? d?.error ?? `HTTP ${res.status}`);
      setRevising(null); setNote('');
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(null); }
  };

  const waiting = reports.filter((r) => r.status === 'SUBMITTED').length;

  return (
    <section aria-label="Round 3 reports">
      <div style={head}>Reports — {waiting} waiting for review ({reports.length} in all)</div>
      {error && <div role="alert" style={{ fontSize: 12.5, color: 'var(--tec-red)', marginBottom: 6 }}>{error}</div>}
      {reports.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--tec-text-3)' }}>No reports yet.</div>
      ) : reports.map((r) => (
        <div key={r.id} data-testid={`review-${r.id}`} style={{ padding: '8px 0', borderBottom: '1px solid var(--tec-border)', fontSize: 12.5, color: 'var(--tec-text-2)', lineHeight: 1.6 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span style={{ fontWeight: 800, color: 'var(--tec-text-1)' }}>{r.app}</span>
            <span style={{ color: 'var(--tec-text-4)' }}>@{r.owner}</span>
            <span style={{ marginInlineStart: 'auto', fontSize: 11.5, fontWeight: 700, color: r.status === 'APPROVED' ? 'var(--tec-green)' : r.status === 'SUBMITTED' ? 'var(--tec-gold)' : 'var(--tec-text-3)' }}>
              {STATUS_LABEL[r.status]}{r.revisions > 0 ? ` · revised ${r.revisions}×` : ''}
            </span>
          </div>
          {r.status === 'SWAPPED' ? (
            <div>Why: “{r.swap_reason}”</div>
          ) : (
            <>
              {r.evidence && (
                <div style={{ fontSize: 11.5, fontWeight: 700, color: r.evidence === 'partial' ? 'var(--tec-green)' : 'var(--tec-text-3)' }}>
                  {r.evidence === 'partial'
                    ? '✓ Signed in with Pi inside the app'
                    : '○ Opened from the campaign — the app did not report a Pi sign-in'}
                </div>
              )}
              <div>What happened: “{r.report}”</div>
              <div>{r.had_problem ? 'Problem' : 'No problem — clear / useful'}: “{r.detail}”</div>
              {r.suggestion && <div style={{ color: 'var(--tec-gold)' }}>Suggestion: “{r.suggestion}”</div>}
              {r.status === 'NEEDS_REVISION' && r.review_note && <div style={{ color: 'var(--tec-text-3)' }}>Your note: “{r.review_note}”</div>}
            </>
          )}

          {r.status === 'SUBMITTED' && (revising === r.id ? (
            <div style={{ marginTop: 6 }}>
              <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={2}
                placeholder="What should they add or clarify? They will read this."
                aria-label="Revision note"
                style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid var(--tec-border)', background: 'transparent', color: 'var(--tec-text-1)', font: 'inherit', fontSize: 12.5, boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button onClick={() => { void review(r.id, 'revise'); }} disabled={note.trim().length < 5 || busy === r.id}
                  style={{ ...small, border: '1px solid var(--tec-gold)', background: 'transparent', color: 'var(--tec-gold)', opacity: note.trim().length < 5 ? 0.5 : 1 }}>
                  Send the note
                </button>
                <button onClick={() => { setRevising(null); setNote(''); }} style={{ ...small, border: 'none', background: 'none', color: 'var(--tec-text-3)' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button onClick={() => { void review(r.id, 'approve'); }} disabled={busy === r.id}
                style={{ ...small, border: 'none', background: 'var(--tec-green)', color: '#04160b' }}>
                Approve
              </button>
              <button onClick={() => { setRevising(r.id); setNote(''); }} disabled={busy === r.id}
                style={{ ...small, border: '1px solid var(--tec-border)', background: 'transparent', color: 'var(--tec-text-1)' }}>
                Needs revision
              </button>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
