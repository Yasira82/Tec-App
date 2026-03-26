'use client';

import styles from './AppsGrid.module.css';

type Props = {
  name:    string;
  emoji:   string;
  href:    string;
  status:  'live' | 'soon';
};

export default function AppCard({ name, emoji, href, status }: Props) {
  const handleOpen = () => {
    if (href.startsWith('http')) {
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = href;
    }
  };

  return (
    <button
      className={`${styles.card} ${status === 'live' ? styles.live : styles.soon}`}
      onClick={handleOpen}
    >
      <span className={styles.emoji}>{emoji}</span>
      <span className={styles.name}>{name}</span>
      {status === 'live' && <span className={styles.liveBadge}>●</span>}
    </button>
  );
}
