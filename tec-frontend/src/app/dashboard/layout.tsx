'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { usePiAuth } from '@/lib-client/hooks/usePiAuth';
import { useTranslation } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import styles from './dashboard.module.css';

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

  if (isLoading || !user) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner} />
      </div>
    );
  }

  const navItems = [
    { icon: '⊞',  label: t.dashboard.nav.dashboard,   href: '/dashboard'                },
    { icon: '◎',  label: t.dashboard.nav.wallet,       href: '/dashboard/wallet'         },
    { icon: '◫',  label: 'Orders',                     href: '/dashboard/orders'         },
    { icon: '💎', label: 'Assets',                     href: '/dashboard/assets'         },
    { icon: '🔔', label: 'Notifications',               href: '/dashboard/notifications'  },
    { icon: '📊', label: 'Analytics',                  href: '/dashboard/analytics'      },
    { icon: '◈',  label: t.dashboard.nav.subscription, href: '/dashboard/subscription'   },
    { icon: '◇',  label: t.dashboard.nav.security,     href: '/dashboard/security'       },
    { icon: '◉',  label: 'Profile',                    href: '/dashboard/profile'        },
    { icon: '◐',  label: 'KYC',                        href: '/dashboard/kyc'            },
  ];

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname?.startsWith(href);

  return (
    <div className={styles.page}>
      <div className={styles.mobileTopBar}>
        <span className={`gold-text ${styles.logoText}`}>{t.common.appName}</span>
        <button className={styles.mobileMenuBtn} onClick={() => setMobileOpen(prev => !prev)} aria-label="Toggle menu">
          <span className={`${styles.menuIcon} ${mobileOpen ? styles.menuIconOpen : ''}`} />
        </button>
      </div>

      {mobileOpen && <div className={styles.mobileOverlay} onClick={() => setMobileOpen(false)} />}

      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarLogo}>
          <span className={`gold-text ${styles.logoText}`}>{t.common.appName}</span>
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
              {isActive(item.href) && <span className={styles.navActiveBar} />}
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

      <main className={styles.main}>{children}</main>
    </div>
  );
}
