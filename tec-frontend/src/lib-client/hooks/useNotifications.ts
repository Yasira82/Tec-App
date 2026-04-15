'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getAccessToken } from '@/lib-client/pi/pi-auth';

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

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [isLoading,     setIsLoading]     = useState(true);
  const [isRefreshing,  setIsRefreshing]  = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const fetchNotifications = useCallback(async (silent = false) => {
    // ✅ P1-1: cookie بدل localStorage
    const token = getAccessToken();
    if (!token) { setIsLoading(false); setError('Not authenticated'); return; }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (silent) setIsRefreshing(true);
    else        setIsLoading(true);
    setError(null);

    try {
      // ✅ P1-3: BFF /api/* بدل Gateway مباشرة
      const res = await fetch('/api/notifications?limit=50', {
        credentials: 'include',
        headers:     { Authorization: `Bearer ${token}` },
        signal:      ctrl.signal,
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
    const token = getAccessToken();
    if (!token) return;
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method:      'PATCH',
        credentials: 'include',
        headers:     { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      await fetch('/api/notifications/read-all', {
        method:      'PATCH',
        credentials: 'include',
        headers:     { Authorization: `Bearer ${token}` },
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
