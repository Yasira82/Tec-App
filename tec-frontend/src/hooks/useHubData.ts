import { useState, useCallback, useEffect } from 'react';
import { bffFetch }                         from '@/lib-client/pi/bff-client';
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

  // bffFetch (C-123 §7): Authorization header from the in-memory session + one
  // silent Pi re-auth on 401 — data loads and SELF-HEALS mid-session even in
  // Pi Browser contexts that refuse cookies. Failures stay non-destructive.
  const refreshBalance = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await bffFetch('/api/bff/wallet/balance', { cache: 'no-store' });
      if (res.ok) { const d = await res.json(); setBalance(`${Number(d.balance).toFixed(2)}`); }
    } catch {}
  }, [userId]);

  const refreshAssets = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await bffFetch('/api/bff/assets/list', { cache: 'no-store' });
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
      const res = await bffFetch('/api/bff/notifications/unread');
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
