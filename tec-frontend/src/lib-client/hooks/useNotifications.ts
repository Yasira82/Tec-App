'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { sessionToken } from '@/lib-client/pi/session-source';
import { bffFetch } from '@/lib-client/pi/bff-client';

/** Sentinel, not prose: a hook has no locale. The page maps it to the reader's
 *  language — this string used to reach the screen as English inside Arabic. */
export const NOT_AUTHENTICATED = 'NOT_AUTHENTICATED';

const getCsrfToken = (): string =>
  (typeof document !== 'undefined'
    ? document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1]
    : '') ?? '';

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
    const token = sessionToken();
    if (!token) { setIsLoading(false); setError(NOT_AUTHENTICATED); return; }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (silent) setIsRefreshing(true);
    else        setIsLoading(true);
    setError(null);

    try {
      // ✅ P1-3: BFF /api/* بدل Gateway مباشرة
      const res = await bffFetch('/api/bff/notifications/list?limit=50', {
        credentials: 'include',
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
    const token = sessionToken();
    if (!token) return;
    // Optimistic update for a snappy UI…
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      const res = await bffFetch('/api/bff/notifications/list', {
        method:      'PATCH',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body:        JSON.stringify({ notificationId: id }),
      });
      // …but if the server rejects, resync from the source of truth so the unread
      // badge never silently lies (a swallowed failure is an invisible bug — C-96).
      if (!res.ok) fetchNotifications(true);
    } catch { fetchNotifications(true); }
  }, [fetchNotifications]);

  const markAllAsRead = useCallback(async () => {
    const token = sessionToken();
    if (!token) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      const res = await bffFetch('/api/bff/notifications/list', {
        method:      'PATCH',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body:        JSON.stringify({ markAll: true }),
      });
      if (!res.ok) fetchNotifications(true);
    } catch { fetchNotifications(true); }
  }, [fetchNotifications]);

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
