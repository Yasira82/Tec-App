'use client';

import { useState }   from 'react';
import Link          from 'next/link';
import { usePathname } from 'next/navigation';
import { useInstallApp } from '@/lib-client/hooks/useInstallApp';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslation, type Translations } from '@/lib/i18n';
import { useSubscriptionPlan } from '@/lib-client/hooks/useSubscriptionPlan';

type NavItem  = { icon: string; label: string; sub?: string; href: string; external?: boolean };
type NavGroup = { label: string; items: NavItem[] };

interface Props {
  user:       { piUsername?: string; subscriptionPlan?: string; kycVerified?: boolean } | null;
  onLogout:   () => void;
}

// Built from translations so labels + descriptions are bilingual. Descriptions
// answer "what is behind this link?" — with 10 entries, names alone were ambiguous.
function buildGroups(m: Translations['dashboard']['menu']): NavGroup[] {
  return [
    {
      label: m.overview,
      items: [
        { icon: '⊞',  label: 'Dashboard',    sub: m.dashboardSub,     href: '/dashboard' },
        { icon: '💳', label: 'Wallet',        sub: m.walletSub,        href: '/dashboard/wallet' },
        { icon: '🔔', label: 'Notifications', sub: m.notificationsSub, href: '/dashboard/notifications' },
      ],
    },
    {
      label: m.apps,
      items: [
        { icon: '🧾', label: 'Orders',        sub: m.ordersSub,        href: '/dashboard/orders' },
        { icon: '💎', label: 'Assets',        sub: m.assetsSub,        href: '/dashboard/assets' },
        { icon: '📊', label: 'Analytics',     sub: m.analyticsSub,     href: '/dashboard/analytics' },
        { icon: '📡', label: 'Observability', sub: m.observabilitySub, href: '/dashboard/observability' },
      ],
    },
    {
      label: m.account,
      items: [
        { icon: '◈',  label: 'Subscription', sub: m.subscriptionSub, href: '/dashboard/subscription' },
        { icon: '◐',  label: 'KYC',           sub: m.kycSub,          href: '/dashboard/kyc' },
        { icon: '◉',  label: 'Profile',       sub: m.profileSub,      href: '/dashboard/profile' },
        // 'Security' is hidden until it is backed by real data. It shipped with
        // hardcoded sessions/devices/backup-codes and dead Revoke/Remove buttons —
        // security controls that lie are worse than no security page at all.
      ],
    },
    {
      // These pages already existed but nothing linked to them, so nobody could
      // reach them: the referral loop (the platform's growth mechanism) and the
      // Pioneer FAQ that answers "is this safe? do I pay?" were both invisible.
      label: m.more,
      items: [
        { icon: '🎁', label: m.referrals,  sub: m.referralsSub,  href: '/hub/referral' },
        { icon: '📖', label: m.howItWorks, sub: m.howItWorksSub, href: '/pioneers/faq' },
      ],
    },
  ];
}

export function Sidebar({ user, onLogout }: Props) {
  const pathname    = usePathname();
  const { t }       = useTranslation();
  // Real plan from commerce — NOT user.subscriptionPlan (the session always says FREE).
  const { plan, isPaid } = useSubscriptionPlan();
  const planLabel   = plan === 'FREE' ? 'Free' : plan.charAt(0) + plan.slice(1).toLowerCase();

  const m      = t.dashboard.menu;
  const groups = buildGroups(m);

  const { isStandalone, installUrl, install, copyLink } = useInstallApp();
  const [installSteps, setInstallSteps] = useState(false);
  const [copied,       setCopied]       = useState(false);
  const onInstall = async () => setInstallSteps(await install());
  const onCopy    = async () => {
    if (await copyLink()) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

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
            background: 'linear-gradient(135deg,#F8B820,#D88810)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 14, color: '#0a0800',
            boxShadow: '0 2px 12px rgba(248,184,32,0.3)',
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
          background: 'linear-gradient(135deg,#F8B820,#D88810)',
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

        {/* Language first — the audience is largely Arabic-speaking, and the switch
            used to be a small control buried at the very bottom of the menu. */}
        <div style={{ padding: '2px 4px 10px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--tec-text-3)', letterSpacing: 2, textTransform: 'uppercase', padding: '0 6px 6px' }}>
            {m.language}
          </div>
          <LanguageSwitcher />
        </div>

        {groups.map(group => (
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
                    background: active ? 'rgba(248,184,32,0.1)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(248,184,32,0.2)' : 'transparent'}`,
                    color: active ? 'var(--tec-gold)' : 'var(--tec-text-2)',
                  }}>
                  <span aria-hidden="true" style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: active ? 600 : 400 }}>{item.label}</span>
                    {item.sub && (
                      <span style={{ display: 'block', fontSize: 10, color: 'var(--tec-text-3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.sub}
                      </span>
                    )}
                  </span>
                  {active && <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--tec-gold)' }} />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Bottom ───────────────────────────────────── */}
      <div style={{ padding: 'var(--sp-3)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>

        {/* Install — the prompt existed but only ever rendered on the landing page,
            so a signed-in user could never reach it. Hidden once already installed. */}
        {!isStandalone && (
          <button onClick={onInstall} className="tec-btn"
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 'var(--radius-md)', marginBottom: 6,
              background: 'transparent', border: '1px solid rgba(248,184,32,0.18)',
              color: 'var(--tec-gold)', fontSize: 13, cursor: 'pointer', textAlign: 'start',
            }}>
            <span aria-hidden="true" style={{ fontSize: 16, width: 20, textAlign: 'center' }}>📲</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{m.install}</span>
              <span style={{ display: 'block', fontSize: 10, color: 'var(--tec-text-3)', marginTop: 1 }}>{m.installSub}</span>
            </span>
          </button>
        )}

        {installSteps && (
          <div style={{ padding: '10px', marginBottom: 6, borderRadius: 'var(--radius-md)', background: 'rgba(248,184,32,0.06)', border: '1px solid rgba(248,184,32,0.12)' }}>
            {[t.home.install.step1, t.home.install.step2, t.home.install.step3].map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '4px 0' }}>
                <span style={{ flexShrink: 0, width: 16, height: 16, borderRadius: 999, background: 'rgba(248,184,32,0.16)', color: 'var(--tec-gold)', fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                <span style={{ fontSize: 10, color: 'var(--tec-text-3)', lineHeight: 1.5 }}>{step}</span>
              </div>
            ))}

            {/* The link itself + a copy button — the only step Pi Browser can do. */}
            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--tec-text-2)', wordBreak: 'break-all', userSelect: 'all', padding: '6px 8px', borderRadius: 8, background: 'rgba(0,0,0,0.3)' }}>
              {installUrl}
            </div>
            <button onClick={onCopy} className="tec-btn"
              style={{ width: '100%', marginTop: 6, padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(248,184,32,0.3)', background: 'rgba(248,184,32,0.1)', color: 'var(--tec-gold)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              {copied ? t.home.install.copied : t.home.install.copyLink}
            </button>

            <div style={{ marginTop: 8, fontSize: 9, color: 'var(--tec-text-3)', lineHeight: 1.5 }}>
              {t.home.install.whyBrowser}
            </div>
          </div>
        )}

        {/* Legal — required by the Pi Portal and previously unreachable in-app. */}
        <div style={{ display: 'flex', gap: 12, padding: '0 10px 8px' }}>
          <Link href="/privacy" style={{ fontSize: 10, color: 'var(--tec-text-3)', textDecoration: 'none' }}>{m.privacy}</Link>
          <Link href="/terms"   style={{ fontSize: 10, color: 'var(--tec-text-3)', textDecoration: 'none' }}>{m.terms}</Link>
        </div>

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
