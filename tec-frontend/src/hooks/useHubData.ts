import { useState, useCallback, useEffect } from 'react';
import { tecSession }                       from '@/lib-client/pi/tec-session';
import { PiPrice }                          from '@/lib/hub/types';

interface HubData {
  balance:           string;
  assetCount:        number | null;
  piPrice:           PiPrice | null;
  notifCount:        number;
  time:              string;
  setNotifCount:     (n: number) => void;
  refresh:           () => Promise<void>;
  refreshBalance:    () => Promise<void>;
}

export function useHubData(userId?: string): HubData {
  const [balance,    setBalance]    = useState('—');
  const [assetCount, setAssetCount] = useState<number | null>(null);
  const [piPrice,    setPiPrice]    = useState<PiPrice | null>(null);
  const [notifCount, setNotifCount] = useState(0);
  const [time,       setTime]       = useState('');

  // Cookie + Authorization header (C-123 §7): tecSession.authHeaders() carries
  // the in-memory token, so data loads even in Pi Browser contexts that refuse
  // cookies entirely. Failures stay non-destructive (blank value, no logout).
  const refreshBalance = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch('/api/bff/wallet/balance', { credentials: 'include', cache: 'no-store', headers: tecSession.authHeaders() });
      if (res.ok) { const d = await res.json(); setBalance(`${Number(d.balance).toFixed(2)}`); }
    } catch {}
  }, [userId]);

  const refreshAssets = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch('/api/bff/assets/list', { credentials: 'include', cache: 'no-store', headers: tecSession.authHeaders() });
      if (res.ok) { const d = await res.json(); setAssetCount(d.count ?? d.data?.length ?? 0); }
    } catch {}
  }, [userId]);

  const refreshPrice = useCallback(async () => {
    try {
      const res = await fetch('/api/market/pi-price', { cache: 'no-store' });
      const d   = await res.json();
      if (!d.error) setPiPrice(d);
    } catch {}
  }, []);

  const refreshNotifCount = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch('/api/bff/notifications/unread', { credentials: 'include', headers: tecSession.authHeaders() });
      if (res.ok) { const d = await res.json(); setNotifCount(d.count ?? 0); }
    } catch {}
  }, [userId]);

  const refresh = useCallback(async () => {
    await Promise.all([refreshBalance(), refreshAssets(), refreshPrice(), refreshNotifCount()]);
  }, [refreshBalance, refreshAssets, refreshPrice, refreshNotifCount]);

  useEffect(() => { refreshBalance(); refreshAssets(); }, [refreshBalance, refreshAssets]);

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

  return { balance, assetCount, piPrice, notifCount, time, setNotifCount, refresh, refreshBalance };
}
