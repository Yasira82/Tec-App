'use client';

import { useState }                      from 'react';
import { useRouter }                     from 'next/navigation';
import { usePiAuth }                     from '@/lib-client/hooks/usePiAuth';
import { useSubscriptionPlan }           from '@/lib-client/hooks/useSubscriptionPlan';
import { useKyc }                        from '@/lib-client/hooks/useKyc';
import { DashboardShell, DashboardCard } from '@/components/dashboard';

// ── Info Row ───────────────────────────────────────────────────
function InfoRow({ label, value, mono, copyable }: {
  label: string; value: string; mono?: boolean; copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--sp-4) var(--sp-5)', borderBottom: '1px solid var(--tec-border)' }}>
      <div style={{ flex: 1, minWidth: 0, marginRight: 'var(--sp-4)' }}>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-text-1)', fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)', fontWeight: mono ? 400 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || '—'}
        </div>
      </div>
      {copyable && (
        <button onClick={copy}
          style={{ padding: '5px 12px', borderRadius: 'var(--radius-sm)', background: copied ? 'rgba(34,197,94,0.1)' : 'var(--tec-surface-1)', border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'var(--tec-border)'}`, color: copied ? '#22C55E' : 'var(--tec-text-2)', fontSize: 'var(--text-xs)', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {copied ? '✓' : 'Copy'}
        </button>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, logout } = usePiAuth();

  // Plan comes from commerce, NOT the auth session — /me never carries it, so
  // `user.subscriptionPlan` reported FREE to paying Pro/Enterprise users.
  const { plan }  = useSubscriptionPlan();
  const planLabel = plan === 'FREE' ? 'FREE' : plan;

  // KYC state from the SAME source the KYC page uses, so the two can never disagree.
  // This block used to be hardcoded to "Pending" with no condition — it said Pending
  // forever, including to a fully verified user.
  const { kyc }    = useKyc();
  const kycStatus  = (kyc?.status ?? '').toUpperCase();
  const kycVerified = kycStatus === 'VERIFIED';
  const kycAccent  = kycVerified ? '#22C55E' : kycStatus === 'REJECTED' ? '#ef4444' : 'var(--tec-gold-dark)';
  const kycMessage = kycVerified
    ? `Verified${kyc?.level ? ` — Level ${kyc.level}` : ''}`
    : kycStatus === 'REJECTED'  ? 'Rejected — please resubmit your documents'
    : kycStatus === 'PENDING'   ? 'Under review — we’ll notify you when it’s done'
    : 'Not started — complete to unlock all features';
  const router           = useRouter();

  const handleLogout = () => { logout(); router.push('/'); };
  const handleDelete = () => {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      // TODO: DELETE /api/auth/profile
    }
  };

  const initial = user?.piUsername?.[0]?.toUpperCase() ?? '?';

  return (
    <DashboardShell title="Profile" subtitle="Manage your account information">

      {/* ── Avatar Card ───────────────────────────── */}
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
              {(user?.role ?? 'USER').toUpperCase()}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#8b5cf6', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', padding: '3px 10px', borderRadius: 'var(--radius-full)' }}>
              {planLabel}
            </span>
          </div>
        </div>
      </div>

      {/* ── Account Info ──────────────────────────── */}
      <DashboardCard title="Account Information" subtitle="Pi Network identity" padding="0">
        <InfoRow label="Pi Username"  value={`@${user?.piUsername ?? ''}`} />
        <InfoRow label="Pi UID"       value={user?.piId ?? ''}   mono copyable />
        <InfoRow label="TEC User ID"  value={user?.id ?? ''}     mono copyable />
        <InfoRow label="Role"         value={(user?.role ?? 'user').toUpperCase()} />
        <InfoRow label="Plan"         value={planLabel} />
        <InfoRow label="Member Since" value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'} />
      </DashboardCard>

      {/* ── KYC Status ────────────────────────────── */}
      <DashboardCard
        title="Verification"
        action={
          <button onClick={() => router.push('/dashboard/kyc')}
            style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border)', color: 'var(--tec-text-2)', fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
            Go to KYC →
          </button>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'var(--sp-4)', background: 'var(--tec-surface-1)', border: `1px solid ${kycAccent}33`, borderRadius: 'var(--radius-md)' }}>
          <span style={{ fontSize: 24 }}>🪪</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--tec-text-1)', marginBottom: 2 }}>KYC Verification</div>
            <div style={{ fontSize: 'var(--text-xs)', color: kycAccent }}>{kycMessage}</div>
          </div>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: kycAccent, flexShrink: 0 }} />
        </div>
      </DashboardCard>

      {/* ── Admin: KYC Review (admins only) ────────── */}
      {user?.role === 'admin' && (
        <DashboardCard title="Admin">
          <button onClick={() => router.push('/hub/admin/kyc')}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 'var(--sp-4)', background: 'var(--tec-surface-1)', border: '1px solid rgba(var(--tec-gold-rgb),0.25)', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ fontSize: 22 }}>🛡️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--tec-text-1)' }}>KYC Review</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>Approve or reject identity submissions</div>
            </div>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--tec-gold)' }}>→</span>
          </button>
        </DashboardCard>
      )}

      {/* ── Connected Apps ────────────────────────── */}
      <DashboardCard title="Connected Apps">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'var(--sp-3) var(--sp-4)', background: 'var(--tec-surface-1)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--tec-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: '#0a0800', flexShrink: 0 }}>T</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--tec-text-1)' }}>TEC Platform</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>Pi Network</div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#22C55E', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', padding: '2px 10px', borderRadius: 'var(--radius-full)', letterSpacing: 1 }}>CONNECTED</span>
        </div>
      </DashboardCard>

      {/* ── Quick Actions ─────────────────────────── */}
      <DashboardCard title="Quick Actions">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 'var(--sp-3)' }}>
          {[
            { icon: '💎', label: 'Assets',       sub: 'View your assets',   href: '/dashboard/assets'        },
            { icon: '💳', label: 'Wallet',        sub: 'Pi balance',         href: '/dashboard/wallet'        },
            { icon: '🔒', label: 'Security',      sub: 'Account security',   href: '/dashboard/security'      },
            { icon: '🔔', label: 'Notifications', sub: 'View notifications', href: '/dashboard/notifications' },
          ].map(a => (
            <button key={a.href} onClick={() => router.push(a.href)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'var(--sp-3) var(--sp-4)', background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
              <span style={{ fontSize: 20 }}>{a.icon}</span>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--tec-text-1)' }}>{a.label}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)' }}>{a.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </DashboardCard>

      {/* ── Danger Zone ───────────────────────────── */}
      <DashboardCard title="Danger Zone">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>Delete Account</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', lineHeight: 1.5 }}>
              Permanently delete your account and all associated data.
            </div>
          </div>
          <button onClick={handleDelete}
            style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
            Delete Account
          </button>
        </div>
      </DashboardCard>

    </DashboardShell>
  );
}
