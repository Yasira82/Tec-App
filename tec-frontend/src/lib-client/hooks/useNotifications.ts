'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

export type NotifType = 'PAYMENT' | 'WALLET' | 'KYC' | 'SECURITY' | 'SYSTEM';

export interface Notification {
  id:         string;
  user_id:    string;
  type:       NotifType;
  title:      string;
  message:    string;
  read:       boolean;
  metadata:   Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount:   number;
  isLoading:     boolean;
  isRefreshing:  boolean;
  error:         string | null;
  refetch:       () => void;
  markAsRead:    (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [isLoading,     setIsLoading]     = useState(true);
  const [isRefreshing,  setIsRefreshing]  = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const getToken = (): string | null =>
    typeof window !== 'undefined'
      ? localStorage.getItem('tec_access_token')
      : null;

  const fetchNotifications = useCallback(async (silent = false) => {
    const token = getToken();
    if (!token) { setIsLoading(false); setError('Not authenticated'); return; }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (silent) setIsRefreshing(true);
    else        setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${GATEWAY}/api/notification?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
        signal:  ctrl.signal,
      });
      if (!res.ok) throw new Error(`Notifications fetch failed: ${res.status}`);
      const data: { success: boolean; data: { notifications: Notification[]; unreadCount: number } } =
        await res.json();

      setNotifications(data.data.notifications);
      setUnreadCount(data.data.unreadCount);
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message ?? 'Unknown error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const refetch = useCallback(() => fetchNotifications(true), [fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    const token = getToken();
    if (!token) return;
    try {
      await fetch(`${GATEWAY}/api/notification/${id}/read`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      await fetch(`${GATEWAY}/api/notification/read-all`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    return () => abortRef.current?.abort();
  }, []); // eslint-disable-line

  return {
    notifications, unreadCount,
    isLoading, isRefreshing, error,
    refetch, markAsRead, markAllAsRead,
  };
}
