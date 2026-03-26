'use client';

import Link from 'next/link';
import { TecUser } from '@/types/pi.types';
import styles from './HubHeader.module.css';

interface Props { user: TecUser | null; }

export default function HubHeader({ user }: Props) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <span className={styles.logo}>TEC</span>
        <span className={styles.tagline}>Super App</span>
      </div>
      <div className={styles.right}>
        <Link href="/dashboard/notifications" className={styles.bell}>
          🔔
        </Link>
        <Link href="/dashboard" className={styles.user}>
          <span className={styles.avatar}>
            {user?.piUsername?.[0]?.toUpperCase() ?? 'U'}
          </span>
          <span className={styles.username}>@{user?.piUsername}</span>
        </Link>
      </div>
    </header>
  );
}
