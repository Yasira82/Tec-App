'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { getAccessToken, getStoredUser } from '@/lib-client/pi/pi-auth';

export interface WalletUpdatedEvent {
  type:    'wallet.updated';
  balance: number;
  amount:  number;
  txType:  'credit' | 'debit';
  txId:    string;
}

interface UseWalletRealtimeOptions {
  onBalanceUpdate: (event: WalletUpdatedEvent) => void;
  onNewTx?:        () => void;
  enabled?:        boolean;
}

const MAX_RETRIES   = 5;
const PING_INTERVAL = 25_000;
const BACKOFF_BASE  = 1_000;

export function useWalletRealtime({
  onBalanceUpdate,
  onNewTx,
  enabled = true,
}: UseWalletRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false);

  const wsRef      = useRef<WebSocket | null>(null);
  const retryRef   = useRef(0);
  const pingRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // ✅ P1-2: من الـ cookie مش localStorage
  const getToken  = (): string | null => getAccessToken();
  const getUserId = (): string | null => {
    const user = getStoredUser() as { id?: string; uid?: string } | null;
    return user?.id ?? user?.uid ?? null;
  };

  const cleanup = useCallback(() => {
    if (pingRef.current) clearInterval(pingRef.current);
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const connect = useCallback(async () => {
    if (!mountedRef.current) return;
    const token  = getToken();
    const userId = getUserId();
    if (!token || !userId) return;

    cleanup();

    // ✅ P1: fetch WebSocket URL from BFF — no NEXT_PUBLIC_ env var
    let wsBaseUrl: string;
    try {
      const res = await fetch('/api/bff/realtime');
      if (!res.ok) return;
      const data = await res.json() as { url: string };
      wsBaseUrl = data.url;
    } catch {
      return;
    }
    if (!mountedRef.current) return;

    // ✅ P1-7: token مش في الـ URL — بيتبعت كـ first message بعد الـ connect
    const url = `${wsBaseUrl}/wallet?userId=${userId}`;
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retryRef.current = 0;
      setIsConnected(true);

      // ✅ Send auth as first message — مش في الـ URL
      ws.send(JSON.stringify({ type: 'auth', token }));

      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, PING_INTERVAL);
    };

    ws.onmessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as WalletUpdatedEvent | { type: 'pong' };
        if (data.type === 'wallet.updated') {
          onBalanceUpdate(data);
          onNewTx?.();
        }
      } catch {
        /* ignore */
      }
    };

    ws.onerror = () => {
      /* handled in onclose */
    };

    ws.onclose = () => {
      if (pingRef.current) clearInterval(pingRef.current);
      setIsConnected(false);
      if (!mountedRef.current) return;
      if (retryRef.current < MAX_RETRIES) {
        const delay = BACKOFF_BASE * Math.pow(2, retryRef.current);
        retryRef.current += 1;
        setTimeout(connect, delay);
      }
    };
  }, [onBalanceUpdate, onNewTx, cleanup]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) connect();
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [enabled, connect, cleanup]);

  return { isConnected };
}
