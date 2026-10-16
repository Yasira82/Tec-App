import { useEffect, useState } from 'react';
import { bffFetch } from '@/lib-client/pi/bff-client';
import { normalizePayment, type Payment } from '@/lib/dashboard-data';

/** How many Pi payments the wallet page lists, newest first. */
export const APP_PAYMENTS_LIMIT = 20;

/**
 * The caller's Pi payments to TEC apps, newest first — the BFF history route.
 * `null` until loaded and on failure: the list then shows nothing rather than a
 * fabricated empty history.
 */
export function useAppPayments(enabled: boolean): Payment[] | null {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    (async () => {
      try {
        const res = await bffFetch(`/api/bff/payments/history?limit=${APP_PAYMENTS_LIMIT}&sort=desc`, { cache: 'no-store' });
        if (!res.ok) return;
        const d    = await res.json();
        const rows = d?.data?.payments ?? d?.data;
        if (alive && Array.isArray(rows)) setPayments(rows.map(normalizePayment));
      } catch { /* the list is optional; absent beats wrong */ }
    })();
    return () => { alive = false; };
  }, [enabled]);
  return payments;
}
