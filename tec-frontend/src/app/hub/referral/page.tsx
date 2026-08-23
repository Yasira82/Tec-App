'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams }                  from 'next/navigation';
import { usePiAuth }                         from '@/lib-client/hooks/usePiAuth';
import { useTranslation, fill }              from '@/lib/i18n';
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
  const { t }        = useTranslation();
  const r            = t.hub.referral;
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
      setError(e instanceof Error ? e.message : r.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [r.loadFailed]);

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
        throw new Error(json?.error ?? json?.message ?? r.applyFailed);
      }
      try { sessionStorage.removeItem(REF_KEY); } catch { /* ignore */ }
      setApply({ kind: 'ok', msg: fill(r.applied, { days: bonusDays }) });
    } catch (e) {
      setApply({ kind: 'error', msg: e instanceof Error ? e.message : r.applyFailed });
    }
  }, [bonusDays, r.applied, r.applyFailed]);

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
          title: r.shareText,
          text:  fill(r.shareBody, { days: bonusDays }),
          url:   inviteLink,
        }).catch(() => { /* user cancelled */ });
    } else {
      copy(inviteLink, 'link');
    }
  };

  return (
    <HubSubShell title={r.title} subtitle={fill(r.subtitle, { days: bonusDays })}>

      {/* ── How it works ─────────────────────────────── */}
      <div className="tec-fade-in" style={{
        padding: 'var(--sp-5) var(--sp-6)', marginBottom: 'var(--sp-5)',
        background: 'linear-gradient(135deg,rgba(var(--tec-gold-rgb),0.06),rgba(var(--tec-gold-rgb),0.02))',
        border: '1px solid var(--tec-border-gold)', borderRadius: 'var(--radius-xl)',
      }}>
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--tec-text-1)', marginBottom: 6 }}>
          {r.howTitle}
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-2)', lineHeight: 1.6 }}>
          {fill(r.howBody, { days: bonusDays })}
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4)',
          color: 'var(--tec-red)', fontSize: 'var(--text-sm)', marginBottom: 'var(--sp-5)',
        }}>⚠ {error}</div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', color: 'var(--tec-text-3)', padding: 'var(--sp-8)' }}>
          {r.loading}
        </div>
      )}

      {!loading && data && (
        <>
          {/* ── My link + code ── */}
          <DashboardCard title={r.linkTitle} subtitle={r.linkSub}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <input
                readOnly
                dir="ltr"
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
                {copied === 'link' ? `✓ ${r.copied}` : r.copyLink}
              </button>
              <button onClick={share} style={btnGold()}>{r.share}</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
                {r.code}
              </span>
              <span dir="ltr" style={{
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 800,
                letterSpacing: 2, color: 'var(--tec-gold)',
              }}>{data.code}</span>
              <button onClick={() => copy(data.code, 'code')} style={btn(copied === 'code')}>
                {copied === 'code' ? '✓' : t.common.copy}
              </button>
            </div>
          </DashboardCard>

          {/* ── Stats ── */}
          <div style={{ display: 'flex', gap: 12, marginTop: 'var(--sp-4)' }}>
            <StatTile label={r.pending}  value={data.stats.pending}  color="var(--tec-text-1)" />
            <StatTile label={r.rewarded} value={data.stats.rewarded} color="var(--tec-green)" />
            <StatTile label={r.total}    value={data.stats.total}    color="var(--tec-gold)" />
          </div>

          {/* ── Apply a code ── */}
          <div style={{ marginTop: 'var(--sp-4)' }}>
            <DashboardCard title={r.haveCode} subtitle={r.haveCodeSub}>
              {apply.kind === 'ok' ? (
                <div style={{
                  background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
                  borderRadius: 'var(--radius-md)', padding: 'var(--sp-4)',
                  color: 'var(--tec-green)', fontSize: 'var(--text-sm)',
                }}>{apply.msg}</div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      value={manual}
                      onChange={(e) => setManual(e.target.value.toUpperCase())}
                      placeholder={r.enterCode}
                      dir="ltr"
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
                      {apply.kind === 'applying' ? r.applying : r.apply}
                    </button>
                  </div>
                  {apply.kind === 'error' && (
                    <div style={{ marginTop: 10, color: 'var(--tec-red)', fontSize: 'var(--text-sm)' }}>
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
          {r.signIn}
        </div>
      )}
    </HubSubShell>
  );
}

/** The Suspense fallback is a full shell of its own, so it needs the dictionary too —
 *  an English "Loading…" flashing before an Arabic page is the kind of seam that makes
 *  a translated app feel bolted on. */
function ReferralFallback() {
  const { t } = useTranslation();
  return (
    <HubSubShell title={t.hub.referral.title} subtitle={fill(t.hub.referral.subtitle, { days: 30 })}>
      <div style={{ textAlign: 'center', color: 'var(--tec-text-3)', padding: 'var(--sp-8)' }}>
        {t.hub.referral.loading}
      </div>
    </HubSubShell>
  );
}

export default function HubReferralPage() {
  return (
    <Suspense fallback={<ReferralFallback />}>
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
    color: active ? 'var(--tec-green)' : 'var(--tec-text-2)',
    fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  };
}
function btnGold(disabled = false): React.CSSProperties {
  return {
    padding: '10px 18px', borderRadius: 'var(--radius-md)',
    background: disabled ? 'var(--tec-surface-1)' : 'var(--tec-gold)',
    border: 'none', color: disabled ? 'var(--tec-text-3)' : '#0a0800',
    fontSize: 'var(--text-sm)', fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
  };
}
