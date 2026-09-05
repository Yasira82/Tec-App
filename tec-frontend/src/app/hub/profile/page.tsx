'use client';

import { useState }      from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter }     from 'next/navigation';
import { useTranslation, bcp47 }  from '@/lib/i18n';
import { usePiAuth }     from '@/lib-client/hooks/usePiAuth';
import { useSubscriptionPlan } from '@/lib-client/hooks/useSubscriptionPlan';
import { useKyc }        from '@/lib-client/hooks/useKyc';
import { normalizePlan } from '@/lib/subscription/entitlements';
import { HubSubShell }   from '@/components/hub';
import { DashboardCard } from '@/components/dashboard';
import { FeedbackCard } from '@/components/feedback/FeedbackCard';

function InfoRow({ label, value, mono, copyable }: {
  label: string; value: string; mono?: boolean; copyable?: boolean;
}) {
  const { t, dir } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--sp-4) var(--sp-5)', borderBottom: '1px solid var(--tec-border)' }}>
      <div style={{ flex: 1, minWidth: 0, marginInlineEnd: 'var(--sp-4)' }}>
        {/* Upper-casing is a Latin typographic device — Arabic has no case, so on an
            Arabic label it reaches only the embedded brand token and turns "Pi" into
            "PI". Worth keeping in English, worth dropping in Arabic. */}
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', letterSpacing: 1, textTransform: dir === 'rtl' ? 'none' : 'uppercase', marginBottom: 3 }}>{label}</div>
        {/* A UUID or a Pi handle is Latin data sitting in an Arabic row. Without an
            explicit direction the bidi algorithm reorders its runs — a hyphenated id
            can come back with its segments swapped, which looks like a different id.
            `mono` marks exactly the rows that hold such data. */}
        <div dir={mono ? 'ltr' : undefined} style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-1)', fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)', fontWeight: mono ? 400 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || '—'}
        </div>
      </div>
      {copyable && (
        <button onClick={copy}
          style={{ padding: '5px 12px', borderRadius: 'var(--radius-sm)', background: copied ? 'rgba(34,197,94,0.1)' : 'var(--tec-surface-1)', border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'var(--tec-border)'}`, color: copied ? 'var(--tec-green)' : 'var(--tec-text-2)', fontSize: 'var(--text-xs)', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {copied ? '✓' : t.common.copy}
        </button>
      )}
    </div>
  );
}

export default function HubProfilePage() {
  const { t, locale } = useTranslation();
  const { user, logout } = usePiAuth();

  // Plan comes from commerce, NOT the auth session — /me never carries it, so
  // `user.subscriptionPlan` reported FREE to paying Pro/Enterprise users.
  const { plan }  = useSubscriptionPlan();
  // `plan` is the enum from commerce; the reader gets its translated name.
  const planLabel = t.hub.plans[normalizePlan(plan)].name.toUpperCase();
  // `role` is a backend enum ('admin'), but it renders where a WORD belongs. An
  // unknown role falls back to the raw value rather than silently reading "User" —
  // a role we cannot name is something to notice, not to paper over (P6).
  const roleKey   = String(user?.role ?? 'user').toLowerCase();
  const roleLabel = (t.hub.profile.roles as Record<string, string>)[roleKey] ?? roleKey.toUpperCase();

  // KYC state from the SAME source the KYC page uses, so the two can never disagree.
  // This block used to be hardcoded to "Pending" with no condition — it said Pending
  // forever, including to a fully verified user.
  const { kyc }    = useKyc();
  const kycStatus  = (kyc?.status ?? '').toUpperCase();
  const kycVerified = kycStatus === 'VERIFIED';
  const kycAccent  = kycVerified ? 'var(--tec-green)' : kycStatus === 'REJECTED' ? 'var(--tec-red)' : 'var(--tec-gold-dark)';
  // The translucent companion is spelled out rather than derived: a design token
  // cannot carry an appended alpha (`var(--x)33` is not a colour).
  const kycEdge    = kycVerified ? 'rgba(34,197,94,0.2)' : kycStatus === 'REJECTED' ? 'rgba(239,68,68,0.2)' : 'rgba(var(--tec-gold-rgb),0.2)';
  const kycMessage = kycVerified
    ? (kyc?.level ? t.hub.profile.kycVerifiedLevel.replace('{n}', String(kyc.level)) : t.hub.profile.kycVerified)
    : kycStatus === 'REJECTED'  ? t.hub.profile.kycRejected
    : kycStatus === 'PENDING'   ? t.hub.profile.kycPending
    : t.hub.profile.kycNotStarted;
  const router           = useRouter();

  const handleLogout = () => { logout(); router.push('/'); };
  const handleDelete = () => {
    if (confirm(t.hub.profile.deleteConfirm)) {
      // TODO: DELETE /api/auth/profile
    }
  };

  const initial = user?.piUsername?.[0]?.toUpperCase() ?? '?';

  return (
    <HubSubShell title={t.hub.profile.title} subtitle={t.hub.profile.subtitle}>

      {/* ── Avatar ──────────────────────────────────── */}
      <div className="tec-fade-in" style={{
        display: 'flex', alignItems: 'center', gap: 'var(--sp-5)',
        padding: 'var(--sp-6)', marginBottom: 'var(--sp-5)',
        background: 'linear-gradient(135deg,rgba(var(--tec-gold-rgb),0.06),rgba(var(--tec-gold-rgb),0.02))',
        border: '1px solid var(--tec-border-gold)', borderRadius: 'var(--radius-xl)',
      }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', flexShrink: 0, background: 'var(--tec-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: '#0a0800', boxShadow: '0 4px 20px rgba(var(--tec-gold-rgb),0.25)' }}>
          {initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--tec-text-1)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            @{user?.piUsername}
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--tec-gold)', background: 'var(--tec-gold-glow)', border: '1px solid var(--tec-border-gold)', padding: '3px 10px', borderRadius: 'var(--radius-full)' }}>
              {roleLabel}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--tec-purple)', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', padding: '3px 10px', borderRadius: 'var(--radius-full)' }}>
              {planLabel}
            </span>
          </div>
        </div>
      </div>

      {/* ── Account Info ────────────────────────────── */}
      <DashboardCard title={t.hub.profile.accountInfo} subtitle={t.hub.profile.accountInfoSub} padding="0">
        <InfoRow label={t.hub.profile.piUsername}  value={`@${user?.piUsername ?? ''}`} mono />
        <InfoRow label={t.hub.profile.piUid}       value={user?.piId ?? ''}   mono copyable />
        <InfoRow label={t.hub.profile.tecUserId}   value={user?.id ?? ''}     mono copyable />
        <InfoRow label={t.hub.profile.role}        value={roleLabel} />
        <InfoRow label={t.hub.profile.plan}        value={planLabel} />
        <InfoRow label={t.hub.profile.memberSince} value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString(bcp47(locale), { month: 'long', day: 'numeric', year: 'numeric' }) : t.hub.profile.na} />
      </DashboardCard>

      {/* ── KYC Status ──────────────────────────────── */}
      <DashboardCard
        title={t.hub.profile.verification}
        action={
          <button onClick={() => router.push('/hub/kyc')}
            style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border)', color: 'var(--tec-text-2)', fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
            {t.hub.profile.goToKyc} →
          </button>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'var(--sp-4)', background: 'var(--tec-surface-1)', border: `1px solid ${kycEdge}`, borderRadius: 'var(--radius-md)' }}>
          <Icon name="idCard" size={24} color={kycAccent} strokeWidth={1.7} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--tec-text-1)', marginBottom: 2 }}>{t.hub.profile.kycTitle}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: kycAccent }}>{kycMessage}</div>
          </div>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: kycAccent, flexShrink: 0 }} />
        </div>
      </DashboardCard>

      {/* ── Admin: KYC Review (admins only) ──────────── */}
      {user?.role === 'admin' && (
        <DashboardCard title={t.hub.profile.admin}>
          <button onClick={() => router.push('/hub/admin/kyc')}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 'var(--sp-4)', background: 'var(--tec-surface-1)', border: '1px solid rgba(var(--tec-gold-rgb),0.25)', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'start' }}>
            <span style={{ fontSize: 22 }}>🛡️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--tec-text-1)' }}>{t.hub.profile.adminKyc}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>{t.hub.profile.adminKycSub}</div>
            </div>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-gold)' }}>→</span>
          </button>
          <button onClick={() => router.push('/hub/admin/pioneers')}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', marginTop: 'var(--sp-3)', padding: 'var(--sp-4)', background: 'var(--tec-surface-1)', border: '1px solid rgba(var(--tec-gold-rgb),0.25)', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'start' }}>
            <span style={{ fontSize: 22 }}>🏆</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--tec-text-1)' }}>Pioneer coverage</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>Which apps are short of Pi&apos;s claim threshold</div>
            </div>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-gold)' }}>→</span>
          </button>
          <button onClick={() => router.push('/hub/admin/feedback')}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', marginTop: 'var(--sp-3)', padding: 'var(--sp-4)', background: 'var(--tec-surface-1)', border: '1px solid rgba(var(--tec-gold-rgb),0.25)', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'start' }}>
            <span style={{ fontSize: 22 }}>💬</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--tec-text-1)' }}>{t.feedback.adminTitle}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>{t.feedback.adminSub}</div>
            </div>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-gold)' }}>→</span>
          </button>
        </DashboardCard>
      )}

      {/* ── Feedback ─────────────────────────────────────
          Here rather than on the Hub home: someone opens Profile when they are
          already thinking about their account and the app around it, which is
          the same moment they have something to say about it. */}
      <DashboardCard title={t.feedback.title} subtitle={t.feedback.hint}>
        <FeedbackCard page="/hub/profile" />
      </DashboardCard>

      {/* ── Connected Apps ───────────────────────────── */}
      <DashboardCard title={t.hub.profile.connectedApps}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'var(--sp-3) var(--sp-4)', background: 'var(--tec-surface-1)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--tec-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: '#0a0800', flexShrink: 0 }}>T</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--tec-text-1)' }}>{t.hub.profile.tecPlatform}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>{t.hub.profile.piNetwork}</div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tec-green)', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', padding: '2px 10px', borderRadius: 'var(--radius-full)', letterSpacing: 1 }}>{t.hub.profile.connected}</span>
        </div>
      </DashboardCard>

      {/* ── Quick Actions ────────────────────────────── */}
      <DashboardCard title={t.hub.profile.quickActions}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 'var(--sp-3)' }}>
          {[
            { icon: 'gem'    as const, label: t.hub.profile.assets,        sub: t.hub.profile.assetsSub,        href: '/dashboard/assets'  },
            { icon: 'wallet' as const, label: t.hub.profile.wallet,        sub: t.hub.profile.walletSub,        href: '/dashboard/wallet'  },
            { icon: 'bell'   as const, label: t.hub.profile.notifications, sub: t.hub.profile.notificationsSub, href: '/hub/notifications' },
            { icon: 'idCard' as const, label: t.hub.profile.kyc,           sub: t.hub.profile.kycSub,           href: '/hub/kyc'           },
          ].map(a => (
            <button key={a.href} onClick={() => router.push(a.href)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'var(--sp-3) var(--sp-4)', background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'start', width: '100%' }}>
              <Icon name={a.icon} size={20} color="var(--tec-gold)" strokeWidth={1.7} />
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--tec-text-1)' }}>{a.label}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>{a.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </DashboardCard>

      {/* ── Account Actions ─────────────────────────── */}
      <DashboardCard title={t.hub.profile.account}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <button onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'var(--sp-4)', background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'start', width: '100%' }}>
            <span style={{ fontSize: 20 }}>🚪</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--tec-text-1)' }}>{t.hub.profile.signOut}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>{t.hub.profile.signOutSub}</div>
            </div>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-4)', padding: 'var(--sp-4)', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 'var(--radius-md)', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--tec-red)', marginBottom: 2 }}>{t.hub.profile.deleteAccount}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>{t.hub.profile.deleteAccountSub}</div>
            </div>
            <button onClick={handleDelete}
              style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--tec-red)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
              {t.hub.profile.delete}
            </button>
          </div>
        </div>
      </DashboardCard>

    </HubSubShell>
  );
}
