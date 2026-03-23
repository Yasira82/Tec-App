'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { usePiAuth } from '@/lib-client/hooks/usePiAuth';
import { useTranslation } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import styles from './dashboard.module.css';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, isLoading, logout } = usePiAuth();
  const { t }      = useTranslation();
  const router     = useRouter();
  const pathname   = usePathname();

  // ── Mobile menu state ────────────────────────────────────────
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Auth guard
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/');
  }, [isAuthenticated, isLoading, router]);

  // Prevent scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (isLoading || !user) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner} />
      </div>
    );
  }

  const navItems = [
    { icon: '⊞', label: t.dashboard.nav.dashboard,    href: '/dashboard' },
    { icon: '◎', label: t.dashboard.nav.wallet,        href: '/dashboard/wallet' },
    { icon: '◈', label: t.dashboard.nav.subscription,  href: '/dashboard/subscription' },
    { icon: '◇', label: t.dashboard.nav.security,      href: '/dashboard/security' },
    { icon: '◉', label: 'Profile',                     href: '/dashboard/profile' },
    { icon: '◐', label: 'KYC',                         href: '/dashboard/kyc' },
  ];

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname?.startsWith(href);

  return (
    <div className={styles.page}>

      {/* ── Mobile Top Bar ── */}
      <div className={styles.mobileTopBar}>
        <span className={`gold-text ${styles.logoText}`}>
          {t.common.appName}
        </span>
        <button
          className={styles.mobileMenuBtn}
          onClick={() => setMobileOpen(prev => !prev)}
          aria-label="Toggle menu"
        >
          <span className={`${styles.menuIcon} ${mobileOpen ? styles.menuIconOpen : ''}`} />
        </button>
      </div>

      {/* ── Mobile Overlay ── */}
      {mobileOpen && (
        <div
          className={styles.mobileOverlay}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarLogo}>
          <span className={`gold-text ${styles.logoText}`}>
            {t.common.appName}
          </span>
        </div>

        <nav className={styles.nav}>
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive(item.href) ? styles.navItemActive : ''}`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
              {/* Active bar */}
              {isActive(item.href) && (
                <span className={styles.navActiveBar} />
              )}
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarBottom}>
          <LanguageSwitcher />
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <span>⟵</span>
            <span>{t.common.logout}</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className={styles.main}>
        {children}
      </main>

    </div>
  );
  }
