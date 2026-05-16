'use client';

import { useEffect, useState }              from 'react';
import { useRouter, usePathname }           from 'next/navigation';
import Link                                 from 'next/link';
import { usePiAuth }                        from '@/lib-client/hooks/usePiAuth';
import { useTranslation }                   from '@/lib/i18n';
import LanguageSwitcher                     from '@/components/LanguageSwitcher';

type NavItem = { icon: string; label: string; href: string; badge?: number };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout } = usePiAuth();
  const { t }    = useTranslation();
  const router   = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/');
  }, [isAuthenticated, isLoading, router]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const handleLogout = () => { logout(); router.push('/'); };

  const navGroups: { label: string; items: NavItem[] }[] = [
    {
      label: 'Overview',
      items: [
        { icon: '⊞',  label: 'Dashboard',     href: '/dashboard' },
        { icon: '💳', label: 'Wallet',         href: '/dashboard/wallet' },
        { icon: '🔔', label: 'Notifications',  href: '/dashboard/notifications' },
      ],
    },
    {
      label: 'Apps',
      items: [
        { icon: '🧾', label: 'Orders',         href: '/dashboard/orders' },
        { icon: '💎', label: 'Assets',         href: '/dashboard/assets' },
        { icon: '📊', label: 'Analytics',      href: '/dashboard/analytics' },
      ],
    },
    {
      label: 'Account',
      items: [
        { icon: '◈',  label: 'Subscription',  href: '/dashboard/subscription' },
        { icon: '◐',  label: 'KYC',            href: '/dashboard/kyc' },
        { icon: '◉',  label: 'Profile',        href: '/dashboard/profile' },
        { icon: '◇',  label: 'Security',       href: '/dashboard/security' },
      ],
    },
  ];

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname?.startsWith(href);

  if (isLoading || !user) {
    return (
      <div style={{ minHeight: '100vh', background: '#020205', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(212,175,55,0.15)', borderTopColor: '#d4af37', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#020205', color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif', display: 'flex' }}>
      <style>{`
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none} }
        .nav-link:active  { background: rgba(255,255,255,0.08) !important; transform: scale(0.98); }
        .nav-link { transition: background 0.15s ease, color 0.15s ease; }
      `}</style>

      {/* ── Mobile overlay ────────────────────────── */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(2,2,5,0.7)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        />
      )}

      {/* ── Sidebar ───────────────────────────────── */}
      <aside style={{
        width: 240, flexShrink: 0,
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 210,
        background: 'rgba(10,10,15,0.95)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
        '@media (min-width: 1024px)': { transform: 'translateX(0)' },
      }}
        className="lg:translate-x-0"
      >
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <Link href="/hub" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 11,
              background: 'linear-gradient(135deg,#d4af37,#b8882a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 14, color: '#0a0800',
              boxShadow: '0 2px 12px rgba(212,175,55,0.3)',
            }}>T</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#d4af37', letterSpacing: 1.5, lineHeight: 1 }}>TEC</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', letterSpacing: 2, lineHeight: 1.4 }}>ECOSYSTEM</div>
            </div>
          </Link>
        </div>

        {/* User */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'linear-gradient(135deg,#d4af37,#b8882a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, color: '#0a0800', flexShrink: 0,
          }}>
            {user.piUsername?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              @{user.piUsername}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 0.5 }}>
              {user.subscriptionPlan ?? 'Free Plan'}
            </div>
          </div>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 1,
            color: '#d4af37', background: 'rgba(212,175,55,0.1)',
            border: '1px solid rgba(212,175,55,0.2)',
            borderRadius: 999, padding: '2px 8px',
          }}>
            {(user as { kycVerified?: boolean }).kycVerified ? 'KYC ✓' : 'FREE'}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {navGroups.map(group => (
            <div key={group.label} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.2)', letterSpacing: 2, textTransform: 'uppercase', padding: '6px 10px 4px' }}>
                {group.label}
              </div>
              {group.items.map(item => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="nav-link"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 10px', borderRadius: 12, marginBottom: 1,
                      textDecoration: 'none',
                      background: active ? 'rgba(212,175,55,0.1)' : 'transparent',
                      border: `1px solid ${active ? 'rgba(212,175,55,0.2)' : 'transparent'}`,
                      color: active ? '#d4af37' : 'rgba(255,255,255,0.5)',
                    }}>
                    <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, flex: 1 }}>{item.label}</span>
                    {item.badge && item.badge > 0 && (
                      <span style={{
                        minWidth: 18, height: 18, borderRadius: 999,
                        background: '#ef4444', color: '#fff',
                        fontSize: 10, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 4px',
                      }}>{item.badge}</span>
                    )}
                    {active && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#d4af37' }} />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <LanguageSwitcher />
          <button
            onClick={handleLogout}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 12, marginTop: 8,
              background: 'transparent', border: '1px solid rgba(239,68,68,0.15)',
              color: 'rgba(239,68,68,0.6)', fontSize: 13, cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}>
            <span style={{ fontSize: 16 }}>⟵</span>
            <span>{t.common.logout}</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile Top Bar ────────────────────────── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 150,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        background: 'rgba(2,2,5,0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Link href="/hub" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#d4af37,#b8882a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 11, color: '#0a0800' }}>T</div>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#d4af37', letterSpacing: 1.5 }}>TEC</span>
        </Link>
        <button
          onClick={() => setMobileOpen(p => !p)}
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: mobileOpen ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${mobileOpen ? 'rgba(212,175,55,0.25)' : 'rgba(255,255,255,0.08)'}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 4, cursor: 'pointer', padding: 0,
          }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              width: 16, height: 1.5, borderRadius: 999,
              background: mobileOpen ? '#d4af37' : 'rgba(255,255,255,0.6)',
              transform: mobileOpen
                ? i === 0 ? 'rotate(45deg) translate(4px,4px)'
                : i === 2 ? 'rotate(-45deg) translate(4px,-4px)'
                : 'scale(0)'
                : 'none',
              transition: 'all 0.2s ease',
              transformOrigin: 'center',
            }} />
          ))}
        </button>
      </div>

      {/* ── Main Content ──────────────────────────── */}
      <main style={{
        flex: 1,
        marginTop: 64,
        padding: '24px 20px',
        minHeight: 'calc(100vh - 64px)',
        maxWidth: '100%',
      }}>
        {children}
      </main>
    </div>
  );
                      }
