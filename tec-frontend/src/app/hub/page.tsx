'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePiAuth } from '@/lib-client/hooks/usePiAuth';
import HubHeader from '@/components/hub/HubHeader';
import WalletCard from '@/components/hub/WalletCard';
import AppsGrid from '@/components/hub/AppsGrid';
import styles from './hub.module.css';

export default function HubPage() {
  const { user, isAuthenticated, isLoading } = usePiAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <main className={styles.main}>
      <HubHeader user={user} />
      <WalletCard userId={user?.id ?? ''} />
      <AppsGrid />
    </main>
  );
}
