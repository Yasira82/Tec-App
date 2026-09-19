'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePiAuth }   from '@/lib-client/hooks/usePiAuth';
import { HubSubShell } from '@/components/hub';
import { Icon }        from '@/components/ui/Icon';

// Admin-only KYC review console. Only role==='admin' sees the queue; the BFF →
// gateway → kyc-service enforces admin server-side (403 otherwise), so this is
// fail-closed even if the client is tampered with.

interface PendingKyc {
  user_id:      string;
  username:     string | null;
  pi_user_id:   string | null;
  level:        string;
  submitted_at: string | null;
  id_front_url: string | null; // storage keys
  id_back_url:  string | null;
  selfie_url:   string | null;
}

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
};

// Renders a stored KYC document image. The src is a same-origin BFF route that
// streams the bytes from storage (no presigned R2 URL in the browser).
function DocImage({ label, docKey }: { label: string; docKey: string | null }) {
  const [err, setErr] = useState(false);
  const src = docKey ? `/api/kyc/admin/document?key=${encodeURIComponent(docKey)}` : null;

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, color: 'var(--tec-text-3)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{
        aspectRatio: '3 / 2', borderRadius: 10, overflow: 'hidden',
        background: 'var(--tec-surface-2)', border: '1px solid var(--tec-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {!src ? (
          <span style={{ fontSize: 11, color: 'var(--tec-text-3)' }}>—</span>
        ) : err ? (
          <span style={{ fontSize: 11, color: 'var(--tec-red)' }}>Unavailable</span>
        ) : (
          <a href={src} target="_blank" rel="noreferrer" style={{ width: '100%', height: '100%' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- private streamed document, not an optimizable asset */}
            <img src={src} alt={label} onError={() => setErr(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </a>
        )}
      </div>
    </div>
  );
}

function ReviewCard({ kyc, onDone }: { kyc: PendingKyc; onDone: (userId: string) => void }) {
  const [busy, setBusy] = useState<'verify' | 'reject' | null>(null);
  const [err,  setErr]  = useState<string | null>(null);

  const act = async (path: string, body: Record<string, unknown>, kind: 'verify' | 'reject') => {
    setBusy(kind); setErr(null);
    try {
      const res  = await fetch(path, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body:        JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `Failed (${res.status})`);
      onDone(kyc.user_id);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  };

  const reject = () => {
    const reason = window.prompt('Reason for rejection (shown to the user):');
    if (reason === null) return;            // cancelled
    if (!reason.trim()) {                    // OK with an empty box → tell them why nothing happened
      window.alert('A rejection reason is required. Type it in the box, then press OK.');
      return;
    }
    act('/api/kyc/admin/reject', { userId: kyc.user_id, reason: reason.trim() }, 'reject');
  };

  return (
    <div style={{ background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border)', borderRadius: 'var(--radius-xl)', padding: 'var(--sp-5)', marginBottom: 'var(--sp-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
        <div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--tec-text-1)' }}>@{kyc.username ?? kyc.user_id.slice(0, 8)}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>
            Submitted {kyc.submitted_at ? new Date(kyc.submitted_at).toLocaleString() : '—'} · current {kyc.level}
          </div>
        </div>
        <span style={{ fontSize: 10, color: 'var(--tec-gold-dark)', background: 'rgba(var(--tec-gold-rgb),0.1)', border: '1px solid rgba(var(--tec-gold-rgb),0.3)', padding: '3px 10px', borderRadius: 999, letterSpacing: 1, textTransform: 'uppercase' }}>Pending</span>
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
        <DocImage label="ID Front"  docKey={kyc.id_front_url} />
        <DocImage label="ID Back"   docKey={kyc.id_back_url} />
        <DocImage label="Selfie"    docKey={kyc.selfie_url} />
      </div>

      {err && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--sp-3)', fontSize: 'var(--text-sm)', color: 'var(--tec-red)' }}>
          <Icon name="alert" size={15} color="var(--tec-red)" /> {err}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end' }}>
        <button onClick={reject} disabled={busy !== null}
          style={{ padding: '10px 22px', borderRadius: 'var(--radius-md)', background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: 'var(--tec-red)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy === 'reject' ? 'Rejecting…' : 'Reject'}
        </button>
        <button onClick={() => act('/api/kyc/admin/verify', { userId: kyc.user_id, level: 'L1' }, 'verify')} disabled={busy !== null}
          style={{ padding: '10px 26px', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg,var(--tec-green),#16A34A)', border: 'none', color: '#05130a', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy === 'verify' ? 'Verifying…' : 'Verify ✓'}
        </button>
      </div>
    </div>
  );
}

export default function AdminKycReviewPage() {
  const { user, isLoading: authLoading } = usePiAuth();
  const isAdmin = (user as { role?: string } | null)?.role === 'admin';

  const [items,   setItems]   = useState<PendingKyc[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied,  setDenied]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch('/api/kyc/admin/pending', { credentials: 'include' });
      if (res.status === 401 || res.status === 403) { setDenied(true); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `Failed (${res.status})`);
      setItems(data?.data?.kycs ?? []);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

  const remove = (userId: string) => setItems(prev => prev.filter(k => k.user_id !== userId));

  return (
    <HubSubShell
      title="KYC Review"
      subtitle="Admin — identity verification queue"
      loading={authLoading || loading}
      // Reached from Profile's admin row — see the pioneers page.
      backTo="/hub/profile"
    >
      {(denied || (!authLoading && !isAdmin)) ? (
        <div style={{ textAlign: 'center', padding: 'var(--sp-10) var(--sp-6)' }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, margin: '0 auto var(--sp-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <Icon name="shield" size={28} color="var(--tec-red)" />
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--tec-text-1)', marginBottom: 6 }}>Access restricted</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)' }}>This page is for platform admins only.</div>
        </div>
      ) : error ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 'var(--sp-4)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: 'var(--tec-red)', fontSize: 'var(--text-sm)' }}>
          <Icon name="alert" size={16} color="var(--tec-red)" /> {error}
        </div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--sp-10) var(--sp-6)' }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, margin: '0 auto var(--sp-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
            <Icon name="check" size={28} color="var(--tec-green)" />
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--tec-text-1)', marginBottom: 6 }}>All caught up</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)' }}>No KYC submissions are waiting for review.</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-3)', marginBottom: 'var(--sp-4)' }}>
            {items.length} submission{items.length === 1 ? '' : 's'} awaiting review
          </div>
          {items.map(k => <ReviewCard key={k.user_id} kyc={k} onDone={remove} />)}
        </>
      )}
    </HubSubShell>
  );
}
