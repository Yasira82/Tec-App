'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface RealtimeNotification {
  type: string;
  title: string;
  message: string;
  timestamp: string;
  paymentId?: string;
  amount?: number;
}

interface UseRealtimeOptions {
  userId: string | undefined;
  token: string | null;
  onNotification?: (n: RealtimeNotification) => void;
  onWalletUpdate?: (data: { amount: number; currency: string }) => void;
}

export function useRealtimeNotifications({
  userId,
  token,
  onNotification,
  onWalletUpdate,
}: UseRealtimeOptions) {
  const socketRef = useRef<any>(null);
  const [unread, setUnread] = useState(0);
  const [connected, setConnected] = useState(false);

  const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL!;

  const connect = useCallback(() => {
    if (!userId || !token || socketRef.current) return;

    // Dynamic import لتجنب SSR errors
    import('socket.io-client')
      .then(({ io }) => {
        const socket = io(REALTIME_URL, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
          timeout: 10000,
        });

        socket.on('connect', () => {
          setConnected(true);
          console.log('[WS] Connected to realtime service');
        });

        socket.on('disconnect', () => {
          setConnected(false);
          console.log('[WS] Disconnected');
        });

        socket.on('notification.new', (data: RealtimeNotification) => {
          setUnread((prev) => prev + 1);
          onNotification?.(data);
          console.log('[WS] New notification:', data.title);
        });

        socket.on('wallet.updated', (data: any) => {
          onWalletUpdate?.(data);
          console.log('[WS] Wallet updated:', data);
        });

        socket.on('connect_error', (err: Error) => {
          console.warn('[WS] Connection error:', err.message);
        });

        socketRef.current = socket;
      })
      .catch((err) => {
        console.warn('[WS] socket.io-client not available:', err.message);
      });
  }, [userId, token, REALTIME_URL, onNotification, onWalletUpdate]);

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
