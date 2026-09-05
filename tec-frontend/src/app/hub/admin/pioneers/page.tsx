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
  verified:     number;
  openers:      number;
  threshold:    number;
  still_needed: number;
}

interface Coverage {
  threshold:          number;
  total_pioneers:     number;
  verified_pioneers:  number;
  apps_short:         number;
  total_still_needed: number;
  note:               string;
  apps:               AppRow[];
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
  const done = row.still_needed === 0;
  return (
    <div style={{
      background: 'var(--tec-surface)', border: '1px solid var(--tec-border)',
      borderRadius: 'var(--radius-md)', padding: 'var(--sp-3) var(--sp-4)',
      marginBottom: 'var(--sp-2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span dir="ltr" style={{
          fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--tec-text-1)',
          fontFamily: 'var(--font-mono)', flex: 1, minWidth: 0,
        }}>
          {row.app}.pi
        </span>

        {/* The verified count is the number Pi's rule is about. The opener
            count sits behind it in muted text: a wide gap says the traffic is
            there and the verification is not, which is a different problem
            from having no traffic at all. */}
        <span dir="ltr" style={{
          fontSize: 'var(--text-sm)', fontWeight: 800,
          color: done ? 'var(--tec-green)' : 'var(--tec-gold)',
        }}>
          {row.verified} / {row.threshold}
        </span>
        <span dir="ltr" style={{ fontSize: 11, color: 'var(--tec-text-3)', minWidth: 62, textAlign: 'end' }}>
          {row.openers} opened
        </span>
      </div>

      <Bar value={row.verified} of={row.threshold} />

      {!done && (
        <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--tec-text-3)' }}>
          needs {row.still_needed} more verified
        </div>
      )}
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
              { label: 'Verified',     value: data.verified_pioneers,  tone: 'var(--tec-green)' },
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
        </>
      ) : null}
    </HubSubShell>
  );
}
