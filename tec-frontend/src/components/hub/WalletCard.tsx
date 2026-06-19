'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAccessToken } from '@/lib-client/pi/pi-auth';
import styles from './WalletCard.module.css';

interface Props { userId: string; }

export default function WalletCard({ userId }: Props) {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    // ✅ P1-1: cookie بدل localStorage
    const token = getAccessToken();
    fetch('/api/bff/wallet/balance', {
      credentials: 'include',
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setBalance(d.balance ?? 0))
      .catch(() => {});
  }, [userId]);

  return (
    <Link href="/dashboard/wallet" className={styles.card}>
      <div className={styles.label}>Pi Wallet</div>
      <div className={styles.balance}>
        {balance !== null ? balance.toFixed(2) : '—'}
        <span className={styles.currency}>π</span>
      </div>
      <div className={styles.action}>View Transactions →</div>
    </Link>
  );
}
