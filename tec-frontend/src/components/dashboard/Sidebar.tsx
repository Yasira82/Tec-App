'use client';

import Link          from 'next/link';
import { usePathname } from 'next/navigation';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslation } from '@/lib/i18n';
import { useSubscriptionPlan } from '@/lib-client/hooks/useSubscriptionPlan';

type NavItem  = { icon: string; label: string; href: string };
type NavGroup = { label: string; items: NavItem[] };

interface Props {
  user:       { piUsername?: string; subscriptionPlan?: string; kycVerified?: boolean } | null;
  onLogout:   () => void;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { icon: '⊞',  label: 'Dashboard',    href: '/dashboard' },
      { icon: '💳', label: 'Wallet',        href: '/dashboard/wallet' },
      { icon: '🔔', label: 'Notifications', href: '/dashboard/notifications' },
    ],
  },
  {
    label: 'Apps',
    items: [
      { icon: '🧾', label: 'Orders',        href: '/dashboard/orders' },
      { icon: '💎', label: 'Assets',        href: '/dashboard/assets' },
      { icon: '📊', label: 'Analytics',     href: '/dashboard/analytics' },
      { icon: '📡', label: 'Observability', href: '/dashboard/observability' },
    ],
  },
  {
    label: 'Account',
    items: [
      { icon: '◈',  label: 'Subscription', href: '/dashboard/subscription' },
      { icon: '◐',  label: 'KYC',           href: '/dashboard/kyc' },
      { icon: '◉',  label: 'Profile',       href: '/dashboard/profile' },
      { icon: '◇',  label: 'Security',      href: '/dashboard/security' },
    ],
  },
];

export function Sidebar({ user, onLogout }: Props) {
  const pathname    = usePathname();
  const { t }       = useTranslation();
  // Real plan from commerce — NOT user.subscriptionPlan (the session always says FREE).
  const { plan, isPaid } = useSubscriptionPlan();
  const planLabel   = plan === 'FREE' ? 'Free' : plan.charAt(0) + plan.slice(1).toLowerCase();

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname?.startsWith(href);

  return (
    <aside
      aria-label="Main navigation"
      role="navigation"
      style={{
        width: 240, flexShrink: 0,
        height: '100%',
        background: 'rgba(10,10,15,0.97)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
      }}>

      {/* ── Logo ─────────────────────────────────────── */}
      <div style={{ padding: 'var(--sp-5) var(--sp-5) var(--sp-4)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Link href="/hub" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 11,
            background: 'linear-gradient(135deg,#FBBF24,#F59E0B)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 14, color: '#0a0800',
            boxShadow: '0 2px 12px rgba(251,191,36,0.3)',
          }}>T</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--tec-gold)', letterSpacing: 1.5, lineHeight: 1 }}>TEC</div>
            <div style={{ fontSize: 9, color: 'var(--tec-text-3)', letterSpacing: 2, lineHeight: 1.4 }}>ECOSYSTEM</div>
          </div>
        </Link>
      </div>

      {/* ── User card ─────────────────────────────────── */}
      <div style={{ padding: 'var(--sp-3) var(--sp-4)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'linear-gradient(135deg,#FBBF24,#F59E0B)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, color: '#0a0800', flexShrink: 0,
        }}>
          {user?.piUsername?.[0]?.toUpperCase() ?? 'U'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            @{user?.piUsername}
          </div>
          <div style={{ fontSize: 10, color: 'var(--tec-text-3)' }}>
            {planLabel} Plan
          </div>
        </div>
        {/* Plan badge — the REAL commerce plan (the auth session always says FREE).
            Previously this badge rendered the KYC state, so it read "FREE" purely
            because KYC was pending — two unrelated facts under one label. */}
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 1,
          color: isPaid ? '#a78bfa' : 'var(--tec-gold)',
          background: isPaid ? 'rgba(139,92,246,0.12)' : 'var(--tec-gold-glow)',
          border: `1px solid ${isPaid ? 'rgba(139,92,246,0.35)' : 'var(--tec-border-gold)'}`,
          borderRadius: 'var(--radius-full)', padding: '2px 8px',
        }}>
          {plan}
        </div>
      </div>

      {/* ── Nav ──────────────────────────────────────── */}
      <nav style={{ flex: 1, padding: 'var(--sp-3) 10px', overflowY: 'auto' }}>
        {NAV_GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom: 6 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, color: 'var(--tec-text-3)',
              letterSpacing: 2, textTransform: 'uppercase', padding: '6px 10px 4px',
            }}>
              {group.label}
            </div>
            {group.items.map(item => {
              const active = isActive(item.href);
              return (
                <Link key={item.href} href={item.href} className="tec-nav-link"
                  aria-current={active ? 'page' : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 10px', borderRadius: 'var(--radius-md)', marginBottom: 1,
                    textDecoration: 'none',
                    background: active ? 'rgba(251,191,36,0.1)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(251,191,36,0.2)' : 'transparent'}`,
                    color: active ? 'var(--tec-gold)' : 'var(--tec-text-2)',
                  }}>
                  <span aria-hidden="true" style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, flex: 1 }}>{item.label}</span>
                  {active && <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--tec-gold)' }} />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Bottom ───────────────────────────────────── */}
      <div style={{ padding: 'var(--sp-3)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <LanguageSwitcher />
        <button onClick={onLogout} className="tec-btn"
          aria-label="Log out"
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 'var(--radius-md)', marginTop: 8,
            background: 'transparent', border: '1px solid rgba(239,68,68,0.15)',
            color: 'rgba(239,68,68,0.6)', fontSize: 13, cursor: 'pointer',
          }}>
          <span aria-hidden="true" style={{ fontSize: 16 }}>⟵</span>
          <span>{t.common.logout}</span>
        </button>
      </div>
    </aside>
  );
}
