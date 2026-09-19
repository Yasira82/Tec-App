'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePiAuth }   from '@/lib-client/hooks/usePiAuth';
import { HubSubShell } from '@/components/hub';
import { Icon }        from '@/components/ui/Icon';

/**
 * The feedback inbox.
 *
 * The reason this page exists: the fleet has been collecting messages into a
 * table with no reader. Everything below is in service of one question — what
 * are people telling us, and has anyone looked at it.
 *
 * `role === 'admin'` hides the page from everyone else, but that is a
 * COURTESY, not the enforcement. `tec-identity-service` requires the same role
 * on the token and answers 403 otherwise, so a tampered client gets nothing.
 */

type Status = 'NEW' | 'READ' | 'ACTIONED' | 'DISMISSED';

interface Item {
  id:         string;
  app:        string;
  page:       string | null;
  message:    string;
  status:     Status;
  created_at: string;
  username:   string | null;
}

const STATUSES: Status[] = ['NEW', 'READ', 'ACTIONED', 'DISMISSED'];

/** Colour carries the same meaning as the word, never instead of it. */
const TONE: Record<Status, { fg: string; bg: string; bd: string }> = {
  NEW:       { fg: 'var(--tec-gold)',  bg: 'rgba(251,180,74,0.10)', bd: 'rgba(251,180,74,0.30)' },
  READ:      { fg: 'var(--tec-text-2)', bg: 'var(--tec-fill-soft)',  bd: 'var(--tec-border)' },
  ACTIONED:  { fg: 'var(--tec-green)', bg: 'rgba(34,197,94,0.10)',  bd: 'rgba(34,197,94,0.30)' },
  DISMISSED: { fg: 'var(--tec-text-3)', bg: 'var(--tec-fill-softer)', bd: 'var(--tec-border)' },
};

function StatusPill({ status }: { status: Status }) {
  const tone = TONE[status];
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, letterSpacing: 0.6, padding: '3px 8px',
      borderRadius: 999, color: tone.fg, background: tone.bg, border: `1px solid ${tone.bd}`,
    }}>
      {status}
    </span>
  );
}

function Row({ item, onStatus }: { item: Item; onStatus: (id: string, s: Status) => void }) {
  const [busy, setBusy] = useState<Status | null>(null);

  const set = async (s: Status) => {
    setBusy(s);
    try {
      const res = await fetch('/api/admin/feedback', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: item.id, status: s }),
        credentials: 'include',
      });
      if (res.ok) onStatus(item.id, s);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{
      background: 'var(--tec-surface)', border: '1px solid var(--tec-border)',
      borderRadius: 'var(--radius-md)', padding: 'var(--sp-4) var(--sp-5)',
      marginBottom: 'var(--sp-3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <StatusPill status={item.status} />
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'var(--tec-text-2)',
          padding: '3px 8px', borderRadius: 999,
          background: 'var(--tec-fill-soft)', border: '1px solid var(--tec-border)',
        }}>
          {item.app}
        </span>
        {/* A Pi handle and a timestamp are Latin data that may sit in an Arabic
            row; without an explicit direction the bidi algorithm reorders their
            runs and a handle can come back looking like a different one. */}
        <span dir="ltr" style={{ fontSize: 11.5, color: 'var(--tec-text-3)' }}>
          @{item.username ?? 'unknown'}
        </span>
        <span style={{ flex: 1 }} />
        <span dir="ltr" style={{ fontSize: 11, color: 'var(--tec-text-3)' }}>
          {new Date(item.created_at).toLocaleString()}
        </span>
      </div>

      {/* `pre-wrap` because people press Enter, and a report reflowed into one
          paragraph loses the steps they carefully numbered. */}
      <div style={{
        fontSize: 'var(--text-sm)', color: 'var(--tec-text-1)', lineHeight: 1.6,
        whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
      }}>
        {item.message}
      </div>

      {item.page && (
        <div dir="ltr" style={{ marginTop: 6, fontSize: 11, color: 'var(--tec-text-3)', fontFamily: 'var(--font-mono)' }}>
          {item.page}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 'var(--sp-3)', flexWrap: 'wrap' }}>
        {STATUSES.filter((s) => s !== item.status).map((s) => (
          <button
            key={s}
            onClick={() => { void set(s); }}
            disabled={busy !== null}
            style={{
              fontSize: 11, fontWeight: 700, padding: '5px 11px',
              borderRadius: 'var(--radius-sm)', cursor: busy ? 'default' : 'pointer',
              background: 'transparent', border: '1px solid var(--tec-border)',
              color: 'var(--tec-text-2)', opacity: busy ? 0.5 : 1, font: 'inherit',
            }}
          >
            {busy === s ? '…' : s}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AdminFeedbackPage() {
  const { user, isLoading: authLoading } = usePiAuth();
  const isAdmin = (user as { role?: string } | null)?.role === 'admin';

  const [items,   setItems]   = useState<Item[]>([]);
  const [counts,  setCounts]  = useState<Record<string, number>>({});
  const [filter,  setFilter]  = useState<Status | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [denied,  setDenied]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async (status: Status | 'ALL') => {
    setLoading(true); setError(null);
    try {
      const qs  = status === 'ALL' ? '' : `?status=${status}`;
      const res = await fetch(`/api/admin/feedback${qs}`, { credentials: 'include' });
      if (res.status === 401 || res.status === 403) { setDenied(true); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `Failed (${res.status})`);
      setItems(data?.data?.items ?? []);
      setCounts(data?.data?.counts ?? {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!authLoading) void load(filter); }, [authLoading, filter, load]);

  // Update the row in place rather than refetching: a list that jumps under
  // the finger on every tap is unusable on a phone, which is where this gets read.
  const onStatus = (id: string, status: Status) =>
    setItems((prev) =>
      filter === 'ALL'
        ? prev.map((i) => (i.id === id ? { ...i, status } : i))
        : prev.filter((i) => i.id !== id),
    );

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <HubSubShell
      title="Feedback"
      subtitle="Admin — what people are telling us"
      loading={authLoading || loading}
      // Reached from Profile's admin row — see the pioneers page.
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
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--sp-4)', flexWrap: 'wrap' }}>
            {(['ALL', ...STATUSES] as const).map((s) => {
              const active = filter === s;
              const n = s === 'ALL' ? total : (counts[s] ?? 0);
              return (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  style={{
                    fontSize: 11.5, fontWeight: 700, padding: '6px 12px',
                    borderRadius: 999, cursor: 'pointer', font: 'inherit',
                    background: active ? 'var(--tec-fill-soft)' : 'transparent',
                    border: `1px solid ${active ? 'var(--tec-border-gold)' : 'var(--tec-border)'}`,
                    color: active ? 'var(--tec-gold)' : 'var(--tec-text-3)',
                  }}
                >
                  {s} {n > 0 && <span dir="ltr">({n})</span>}
                </button>
              );
            })}
          </div>

          {error ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: 'var(--sp-4)',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 'var(--radius-md)', color: 'var(--tec-red)', fontSize: 'var(--text-sm)',
            }}>
              <Icon name="alert" size={16} color="var(--tec-red)" /> {error}
            </div>
          ) : items.length === 0 && !loading ? (
            <div style={{ textAlign: 'center', padding: 'var(--sp-10) var(--sp-6)' }}>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--tec-text-1)', marginBottom: 6 }}>
                Nothing here
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)' }}>
                {filter === 'ALL' ? 'No feedback has been sent yet.' : `No ${filter} messages.`}
              </div>
            </div>
          ) : (
            items.map((item) => <Row key={item.id} item={item} onStatus={onStatus} />)
          )}
        </>
      )}
    </HubSubShell>
  );
}
