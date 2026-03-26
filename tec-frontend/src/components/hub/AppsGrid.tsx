'use client';

import AppCard from './AppCard';
import styles from './AppsGrid.module.css';

const APPS = [
  { name: 'Wallet',     emoji: '💳', href: '/dashboard/wallet',    status: 'live' as const },
  { name: 'Orders',     emoji: '📦', href: '/dashboard/orders',    status: 'live' as const },
  { name: 'KYC',        emoji: '🪪', href: '/dashboard/kyc',       status: 'live' as const },
  { name: 'AI',         emoji: '🤖', href: '/ai',                  status: 'live' as const },
  { name: 'Commerce',   emoji: '🛒', href: 'https://commerce.pi',  status: 'soon' as const },
  { name: 'Assets',     emoji: '💎', href: 'https://assets.pi',    status: 'soon' as const },
  { name: 'Fundx',      emoji: '📊', href: 'https://fundx.pi',     status: 'soon' as const },
  { name: 'Estate',     emoji: '🏠', href: 'https://estate.pi',    status: 'soon' as const },
  { name: 'Analytics',  emoji: '📈', href: 'https://analytics.pi', status: 'soon' as const },
  { name: 'Connection', emoji: '🔗', href: 'https://connection.pi',status: 'soon' as const },
  { name: 'Insure',     emoji: '🛡️', href: 'https://insure.pi',    status: 'soon' as const },
  { name: 'Nexus',      emoji: '🌐', href: 'https://nexus.pi',     status: 'soon' as const },
];

export default function AppsGrid() {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>Apps</h2>
        <span className={styles.count}>
          {APPS.filter(a => a.status === 'live').length} Live
        </span>
      </div>
      <div className={styles.grid}>
        {APPS.map(app => (
          <AppCard
            key={app.name}
            name={app.name}
            emoji={app.emoji}
            href={app.href}
            status={app.status}
          />
        ))}
      </div>
    </section>
  );
}
