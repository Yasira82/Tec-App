'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams }                  from 'next/navigation';
import { usePiAuth }                         from '@/lib-client/hooks/usePiAuth';
import { HubSubShell }                       from '@/components/hub';
import { DashboardCard }                     from '@/components/dashboard';

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
};

const REF_KEY = 'tec_ref';

interface ReferralData {
  code:  string;
  stats: { pending: number; rewarded: number; total: number };
  reward: { model: string; bonusDays: number; plan: string };
}

type ApplyState =
  | { kind: 'idle' }
  | { kind: 'applying' }
  | { kind: 'ok';    msg: string }
  | { kind: 'error'; msg: string };

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      flex: 1, textAlign: 'center', padding: 'var(--sp-4)',
      background: 'var(--tec-surface-2)', border: '1px solid var(--tec-border)',
      borderRadius: 'var(--radius-lg)',
    }}>
      <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{
        fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', marginTop: 6,
        letterSpacing: 1, textTransform: 'uppercase',
      }}>{label}</div>
    </div>
  );
}

function HubReferralInner() {
  const { isAuthenticated, isLoading } = usePiAuth();
  const searchParams = useSearchParams();

  const [data,    setData]    = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [apply,   setApply]   = useState<ApplyState>({ kind: 'idle' });
  const [manual,  setManual]  = useState('');
  const [copied,  setCopied]  = useState<'code' | 'link' | null>(null);

  const bonusDays = data?.reward.bonusDays ?? 30;
  const inviteLink = data
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://hub.tecosystem.app'}/hub/referral?ref=${data.code}`
    : '';

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/referral', { credentials: 'include' });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error((b as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json?.data?.referral ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  const applyCode = useCallback(async (raw: string) => {
    const code = raw.trim().toUpperCase();
    if (!code) return;
    setApply({ kind: 'applying' });
    try {
      const res  = await fetch('/api/referral', {
        method:  'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body:    JSON.stringify({ code }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error ?? json?.message ?? 'Could not apply code');
      }
      try { sessionStorage.removeItem(REF_KEY); } catch { /* ignore */ }
      setApply({
        kind: 'ok',
        msg:  `Invite locked in 🎉 — you and your inviter each get a free ${bonusDays}-day PRO month when you take your first subscription.`,
      });
    } catch (e) {
      setApply({ kind: 'error', msg: e instanceof Error ? e.message : 'Could not apply code' });
    }
  }, [bonusDays]);

  // Load my referral card once authenticated.
  useEffect(() => {
    if (!isLoading && isAuthenticated) load();
    else if (!isLoading && !isAuthenticated) setLoading(false);
  }, [isLoading, isAuthenticated, load]);

  // Capture an incoming ?ref= (from an invite link). Stash it so it survives the
  // SSO round-trip, then auto-apply once authenticated.
  useEffect(() => {
    const incoming = searchParams.get('ref');
    if (incoming) {
      try { sessionStorage.setItem(REF_KEY, incoming); } catch { /* ignore */ }
    }
    if (!isLoading && isAuthenticated && data) {
      let pending: string | null = incoming;
      if (!pending) { try { pending = sessionStorage.getItem(REF_KEY); } catch { pending = null; } }
      // Don't auto-apply your own code.
      if (pending && pending.trim().toUpperCase() !== data.code && apply.kind === 'idle') {
        applyCode(pending);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated, data]);

  const copy = (text: string, which: 'code' | 'link') => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(which); setTimeout(() => setCopied(null), 2000);
    }).catch(() => { /* ignore */ });
  };

  const share = () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator && inviteLink) {
      (navigator as Navigator & { share: (d: ShareData) => Promise<void> })
        .share({
          title: 'Join me on TEC',
          text:  `Join TEC on Pi — we both get a free ${bonusDays}-day PRO month.`,
          url:   inviteLink,
        }).catch(() => { /* user cancelled */ });
    } else {
      copy(inviteLink, 'link');
    }
  };

  return (
    <HubSubShell title="Invite & Earn" subtitle={`Invite friends — you both get a free ${bonusDays}-day PRO month`}>

      {/* ── How it works ─────────────────────────────── */}
      <div className="tec-fade-in" style={{
        padding: 'var(--sp-5) var(--sp-6)', marginBottom: 'var(--sp-5)',
        background: 'linear-gradient(135deg,rgba(251,191,36,0.06),rgba(251,191,36,0.02))',
        border: '1px solid var(--tec-border-gold)', borderRadius: 'var(--radius-xl)',
      }}>
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--tec-text-1)', marginBottom: 6 }}>
          Give a free month, get a free month 🎁
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-2)', lineHeight: 1.6 }}>
          Share your link. When someone you invite takes their <strong>first subscription</strong>,
          you <strong>both</strong> get a free <strong>{bonusDays}-day PRO month</strong> — added on
          top of any time you already have. The reward is a subscription month, not Pi, and it only
          unlocks on a real subscription (so it stays fair).
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4)',
          color: '#ef4444', fontSize: 'var(--text-sm)', marginBottom: 'var(--sp-5)',
        }}>⚠ {error}</div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', color: 'var(--tec-text-3)', padding: 'var(--sp-8)' }}>
          Loading…
        </div>
      )}

      {!loading && data && (
        <>
          {/* ── My link + code ── */}
          <DashboardCard title="Your invite link" subtitle="Share it anywhere">
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <input
                readOnly
                value={inviteLink}
                onFocus={(e) => e.currentTarget.select()}
                style={{
                  flex: 1, minWidth: 200, padding: '10px 12px',
                  background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border)',
                  borderRadius: 'var(--radius-md)', color: 'var(--tec-text-2)',
                  fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)',
                }}
              />
              <button onClick={() => copy(inviteLink, 'link')}
                style={btn(copied === 'link')}>
                {copied === 'link' ? '✓ Copied' : 'Copy link'}
              </button>
              <button onClick={share} style={btnGold()}>Share</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
                Code
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 800,
                letterSpacing: 2, color: 'var(--tec-gold)',
              }}>{data.code}</span>
              <button onClick={() => copy(data.code, 'code')} style={btn(copied === 'code')}>
                {copied === 'code' ? '✓' : 'Copy'}
              </button>
            </div>
          </DashboardCard>

          {/* ── Stats ── */}
          <div style={{ display: 'flex', gap: 12, marginTop: 'var(--sp-4)' }}>
            <StatTile label="Pending"  value={data.stats.pending}  color="var(--tec-text-1)" />
            <StatTile label="Rewarded" value={data.stats.rewarded} color="#22C55E" />
            <StatTile label="Total"    value={data.stats.total}    color="var(--tec-gold)" />
          </div>

          {/* ── Apply a code ── */}
          <div style={{ marginTop: 'var(--sp-4)' }}>
            <DashboardCard title="Have an invite code?" subtitle="Apply it before your first subscription">
              {apply.kind === 'ok' ? (
                <div style={{
                  background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
                  borderRadius: 'var(--radius-md)', padding: 'var(--sp-4)',
                  color: '#22C55E', fontSize: 'var(--text-sm)',
                }}>{apply.msg}</div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      value={manual}
                      onChange={(e) => setManual(e.target.value.toUpperCase())}
                      placeholder="Enter code"
                      maxLength={16}
                      style={{
                        flex: 1, minWidth: 160, padding: '10px 12px',
                        background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border)',
                        borderRadius: 'var(--radius-md)', color: 'var(--tec-text-1)',
                        fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', letterSpacing: 1,
                      }}
                    />
                    <button
                      onClick={() => applyCode(manual)}
                      disabled={apply.kind === 'applying' || !manual.trim()}
                      style={btnGold(apply.kind === 'applying' || !manual.trim())}
                    >
                      {apply.kind === 'applying' ? 'Applying…' : 'Apply'}
                    </button>
                  </div>
                  {apply.kind === 'error' && (
                    <div style={{ marginTop: 10, color: '#ef4444', fontSize: 'var(--text-sm)' }}>
                      {apply.msg}
                    </div>
                  )}
                </>
              )}
            </DashboardCard>
          </div>
        </>
      )}

      {!loading && !data && !error && (
        <div style={{ textAlign: 'center', color: 'var(--tec-text-3)', padding: 'var(--sp-8)' }}>
          Sign in to get your invite link.
        </div>
      )}
    </HubSubShell>
  );
}

export default function HubReferralPage() {
  return (
    <Suspense fallback={
      <HubSubShell title="Invite & Earn" subtitle="Invite friends — you both get a free PRO month">
        <div style={{ textAlign: 'center', color: 'var(--tec-text-3)', padding: 'var(--sp-8)' }}>Loading…</div>
      </HubSubShell>
    }>
      <HubReferralInner />
    </Suspense>
  );
}

// ── inline button styles (Pi-Browser safe) ──
function btn(active: boolean): React.CSSProperties {
  return {
    padding: '10px 16px', borderRadius: 'var(--radius-md)',
    background: active ? 'rgba(34,197,94,0.1)' : 'var(--tec-surface-1)',
    border: `1px solid ${active ? 'rgba(34,197,94,0.3)' : 'var(--tec-border)'}`,
    color: active ? '#22C55E' : 'var(--tec-text-2)',
    fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  };
}
function btnGold(disabled = false): React.CSSProperties {
  return {
    padding: '10px 18px', borderRadius: 'var(--radius-md)',
    background: disabled ? 'var(--tec-surface-1)' : 'linear-gradient(135deg,#FBBF24,#F59E0B)',
    border: 'none', color: disabled ? 'var(--tec-text-3)' : '#0a0800',
    fontSize: 'var(--text-sm)', fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
  };
}
