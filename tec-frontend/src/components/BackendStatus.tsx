'use client';

import { useState } from 'react';
import { usePlatformHealth } from '../context/PlatformHealthContext';
import styles from './BackendStatus.module.css';

export default function BackendStatus() {
  // Consumer of the single platform health runtime (C-96) — no own poller.
  const { online } = usePlatformHealth();
  const [dismissed, setDismissed] = useState(false);

  if (online || dismissed) return null;

  return (
    <div className={styles.banner} role="alert">
      <span className={styles.message}>⚠️ Backend services are currently offline</span>
      <button className={styles.dismiss} onClick={() => setDismissed(true)} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
