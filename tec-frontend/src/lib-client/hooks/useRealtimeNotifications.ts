'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const isDev = process.env.NODE_ENV !== 'production';

interface RealtimeNotification {
  type:       string;
  title:      string;
  message:    string;
  timestamp:  string;
  paymentId?: string;
  amount?:    number;
}

interface UseRealtimeOptions {
  userId:          string | undefined;
  token:           string | null;
  onNotification?: (n: RealtimeNotification) => void;
  onWalletUpdate?: (data: { amount: number; currency: string }) => void;
}

export function useRealtimeNotifications({
  userId,
  token,
  onNotification,
  onWalletUpdate,
}: UseRealtimeOptions) {
  const socketRef = useRef<ReturnType<typeof import('socket.io-client')['io']> | null>(null);
  const [unread,    setUnread]    = useState(0);
  const [connected, setConnected] = useState(false);

  // Keep callbacks in refs so `connect` does NOT depend on them — otherwise
  // inline callbacks from the caller recreate `connect` every render, re-running
  // the effect and re-fetching /api/bff/realtime on every render (request storm).
  const onNotificationRef = useRef(onNotification);
  const onWalletUpdateRef = useRef(onWalletUpdate);
  useEffect(() => { onNotificationRef.current = onNotification; }, [onNotification]);
  useEffect(() => { onWalletUpdateRef.current = onWalletUpdate; }, [onWalletUpdate]);

  const connect = useCallback(() => {
    if (!userId || !token || socketRef.current) return;

    // ✅ P1: fetch WebSocket URL from BFF — no NEXT_PUBLIC_ env var
    fetch('/api/bff/realtime')
      .then((res) => {
        if (!res.ok) throw new Error(`BFF ${res.status}`);
        return res.json() as Promise<{ url: string | null; enabled?: boolean }>;
      })
      .then(({ url: realtimeUrl }) => {
        if (!realtimeUrl) return null;   // realtime disabled — skip cleanly (no connect)
        return import('socket.io-client').then(({ io }) => ({ io, realtimeUrl }));
      })
      .then((ctx) => {
        if (!ctx) return;
        const { io, realtimeUrl } = ctx;
        const socket = io(realtimeUrl, {
          auth:                { token },
          transports:          ['websocket', 'polling'],
          reconnectionAttempts: 5,
          reconnectionDelay:   2000,
          timeout:             10000,
        });

        socket.on('connect', () => {
          setConnected(true);
          if (isDev) console.log('[WS] Connected to realtime service');
        });

        socket.on('disconnect', () => {
          setConnected(false);
          if (isDev) console.log('[WS] Disconnected');
        });

        socket.on('notification.new', (data: RealtimeNotification) => {
          setUnread((prev) => prev + 1);
          onNotificationRef.current?.(data);
          if (isDev) console.log('[WS] New notification:', data.title);
        });

        socket.on('wallet.updated', (data: { amount: number; currency: string }) => {
          onWalletUpdateRef.current?.(data);
          if (isDev) console.log('[WS] Wallet updated:', data);
        });

        socket.on('connect_error', (err: Error) => {
          if (isDev) console.warn('[WS] Connection error:', err.message);
        });

        socketRef.current = socket;
      })
      .catch((err: Error) => {
        if (isDev) console.warn('[WS] socket.io-client not available:', err.message);
      });
  }, [userId, token]);

  useEffect(() => {
    connect();
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connect]);

  const clearUnread = useCallback(() => setUnread(0), []);

  return { unread, connected, clearUnread };
}
