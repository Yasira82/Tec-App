'use client';

import { useRouter }                     from 'next/navigation';
import { useTranslation }                from '@/lib/i18n';
import { DashboardShell, DashboardCard } from '@/components/dashboard';

/**
 * Security Center — placeholder.
 *
 * The previous version rendered entirely HARDCODED data and shipped it as if it were
 * real: fabricated active sessions (a device the user had never signed in from),
 * fabricated trusted devices, and literal backup codes ('ABC123', 'DEF456', …) offered
 * as 2FA recovery codes. Its Revoke / Remove buttons had no handlers at all.
 *
 * On a financial platform that is not a cosmetic bug — a user who writes down those
 * codes is locked out for good, and a user who "revokes" a session believes they
 * removed an intruder when nothing happened. The page stays reachable (bookmarks keep
 * working) but now states plainly that the feature isn't available yet, and points to
 * the controls that ARE real.
 *
 * To restore it: back each section with real endpoints (sessions, trusted devices,
 * TOTP enrolment + server-generated single-use backup codes), then re-add the nav item
 * in components/dashboard/Sidebar.tsx.
 */
export default function SecurityPage() {
  const router     = useRouter();
  const { t, dir } = useTranslation();
  const ar         = dir === 'rtl';

  const actions = [
    { icon: '🪪', label: ar ? 'التحقق من الهوية (KYC)' : 'Identity verification (KYC)', href: '/dashboard/kyc' },
    { icon: '◉',  label: ar ? 'الملف الشخصي'            : 'Profile',                    href: '/dashboard/profile' },
  ];

  return (
    <DashboardShell dir={dir}>
      <DashboardCard
        title={ar ? 'مركز الأمان' : 'Security Center'}
        subtitle={ar ? 'قريباً' : 'Coming soon'}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 'var(--sp-4)', background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border)', borderRadius: 'var(--radius-md)' }}>
          <span style={{ fontSize: 24 }}>🔒</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--tec-text-1)', marginBottom: 4 }}>
              {ar ? 'إعدادات الأمان قيد التطوير' : 'Security settings are in development'}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', lineHeight: 1.7 }}>
              {ar
                ? 'المصادقة الثنائية وإدارة الجلسات والأجهزة الموثوقة لسه مش متاحة. مش هنعرض بيانات أمان غير حقيقية — الصفحة هترجع لما تتوصّل ببيانات فعلية.'
                : 'Two-factor authentication, session management and trusted devices are not available yet. We will not show security information that isn’t real — this page returns once it is backed by live data.'}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tec-text-3)', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>
            {ar ? 'المتاح دلوقتي' : 'Available now'}
          </div>
          {actions.map(a => (
            <button key={a.href} onClick={() => router.push(a.href)} className="tec-btn"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'var(--sp-3) var(--sp-4)', background: 'var(--tec-surface-1)', border: '1px solid var(--tec-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: ar ? 'right' : 'left', width: '100%' }}>
              <span style={{ fontSize: 18 }}>{a.icon}</span>
              <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--tec-text-1)' }}>{a.label}</span>
              <span style={{ color: 'var(--tec-text-3)' }}>{ar ? '←' : '→'}</span>
            </button>
          ))}
        </div>
      </DashboardCard>

      <div style={{ marginTop: 'var(--sp-4)' }}>
        <button onClick={() => router.push('/dashboard')} className="tec-btn"
          style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--tec-surface-2)', border: '1px solid var(--tec-border)', color: 'var(--tec-text-2)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
          {ar ? '← لوحة التحكم' : '← Dashboard'}
        </button>
      </div>
    </DashboardShell>
  );
}
