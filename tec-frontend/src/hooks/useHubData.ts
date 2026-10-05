import { useState, useCallback, useEffect } from 'react';
import { bffFetch }                         from '@/lib-client/pi/bff-client';
import { PiPrice, asPiPrice }                from '@/lib/hub/types';
import { normalizePayment, type Payment }    from '@/lib/dashboard-data';

/** How many payments the wallet card shows. The full list is on the wallet page. */
export const RECENT_PAYMENTS = 3;

interface HubData {
  balance:           string;
  balanceError:      boolean;
  assetCount:        number | null;
  piPrice:           PiPrice | null;
  notifCount:        number;
  /** Last few payments, newest first. `null` until loaded, and on failure —
   *  the card then shows nothing rather than a fabricated empty history. */
  recentPayments:    Payment[] | null;
  time:              string;
  setNotifCount:     (n: number) => void;
  refresh:           () => Promise<void>;
  refreshBalance:    () => Promise<void>;
}

export function useHubData(userId?: string): HubData {
  const [balance,      setBalance]      = useState('—');
  const [balanceError, setBalanceError] = useState(false);
  const [assetCount,   setAssetCount]   = useState<number | null>(null);
  const [piPrice,      setPiPrice]      = useState<PiPrice | null>(null);
  const [notifCount,   setNotifCount]   = useState(0);
  const [recentPayments, setRecentPayments] = useState<Payment[] | null>(null);
  const [time,         setTime]         = useState('');

  // bffFetch (C-123 §7): Authorization header from the in-memory session + one
  // silent Pi re-auth on 401 — data loads and SELF-HEALS mid-session even in
  // Pi Browser contexts that refuse cookies. Failures stay non-destructive.
  const refreshBalance = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await bffFetch('/api/bff/wallet/balance', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setBalance(`${Number(d.balance).toFixed(2)}`);
        setBalanceError(false);
      } else {
        // Honest state (C-135 §4): surface the failure so the card can offer a
        // retry, instead of an eternal skeleton. Never fabricate a 0 balance.
        setBalanceError(true);
      }
    } catch { setBalanceError(true); }
  }, [userId]);

  const refreshAssets = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await bffFetch('/api/bff/assets/list', { cache: 'no-store' });
      if (res.ok) { const d = await res.json(); setAssetCount(d.count ?? d.data?.length ?? 0); }
    } catch {}
  }, [userId]);

  const refreshPayments = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await bffFetch(`/api/bff/payments/history?limit=${RECENT_PAYMENTS}`, { cache: 'no-store' });
      if (!res.ok) return;
      const d    = await res.json();
      const rows = d?.data?.payments ?? d?.data;
      if (Array.isArray(rows)) setRecentPayments(rows.slice(0, RECENT_PAYMENTS).map(normalizePayment));
    } catch {}
  }, [userId]);

  const refreshPrice = useCallback(async () => {
    try {
      const res = await fetch('/api/market/pi-price', { cache: 'no-store' });
      const d   = await res.json();
      // asPiPrice, not `if (!d.error)`: a 200 with a changed upstream shape
      // carries no error key and used to be stored as-is — see its comment.
      const p   = asPiPrice(d);
      if (p) setPiPrice(p);
    } catch {}
  }, []);

  const refreshNotifCount = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await bffFetch('/api/bff/notifications/unread');
      if (res.ok) { const d = await res.json(); setNotifCount(d.count ?? 0); }
    } catch {}
  }, [userId]);

  const refresh = useCallback(async () => {
    await Promise.all([refreshBalance(), refreshAssets(), refreshPayments(), refreshPrice(), refreshNotifCount()]);
  }, [refreshBalance, refreshAssets, refreshPayments, refreshPrice, refreshNotifCount]);

  useEffect(() => { refreshBalance(); refreshAssets(); refreshPayments(); }, [refreshBalance, refreshAssets, refreshPayments]);

  useEffect(() => {
    refreshNotifCount();
    const id = setInterval(refreshNotifCount, 10000);
    return () => clearInterval(id);
  }, [refreshNotifCount]);

  useEffect(() => {
    refreshPrice();
    const id = setInterval(refreshPrice, 60000);
    return () => clearInterval(id);
  }, [refreshPrice]);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  return { balance, balanceError, assetCount, piPrice, notifCount, recentPayments, time, setNotifCount, refresh, refreshBalance };
}
