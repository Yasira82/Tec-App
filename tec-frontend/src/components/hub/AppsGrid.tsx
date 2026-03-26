'use client';

import styles from './AppsGrid.module.css';

const APPS = [
  { name: 'Wallet',     emoji: '💳', href: '/dashboard/wallet',        status: 'live'   },
  { name: 'Orders',     emoji: '📦', href: '/dashboard/orders',         status: 'live'   },
  { name: 'KYC',        emoji: '🪪', href: '/dashboard/kyc',            status: 'live'   },
  { name: 'Commerce',   emoji: '🛒', href: 'https://commerce.pi',       status: 'soon'   },
  { name: 'Assets',     emoji: '💎', href: 'https://assets.pi',         status: 'soon'   },
  { name: 'Fundx',      emoji: '📊', href: 'https://fundx.pi',          status: 'soon'   },
  { name: 'Estate',     emoji: '🏠', href: 'https://estate.pi',         status: 'soon'   },
  { name: 'Analytics',  emoji: '📈', href: 'https://analytics.pi',      status: 'soon'   },
  { name: 'Connection', emoji: '🔗', href: 'https://connection.pi',     status: 'soon'   },
  { name: 'Insure',     emoji: '🛡️', href: 'https://insure.pi',         status: 'soon'   },
  { name: 'Nexus',      emoji: '🌐', href: 'https://nexus.pi',          status: 'soon'   },
  { name: 'AI',         emoji: '🤖', href: '/ai',                       status: 'live'   },
];

export default function AppsGrid() {
  const handleOpen = (href: string) => {
    if (href.startsWith('http')) {
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = href;
    }
  };

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
          <button
            key={app.name}
            className={`${styles.card} ${app.status === 'live' ? styles.live : styles.soon}`}
            onClick={() => handleOpen(app.href)}
          >
            <span className={styles.emoji}>{app.emoji}</span>
            <span className={styles.name}>{app.name}</span>
            {app.status === 'live' && (
              <span className={styles.liveBadge}>●</span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
