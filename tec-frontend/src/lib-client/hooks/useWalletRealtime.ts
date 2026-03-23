'use client';
import { useEffect, useRef, useCallback, useState } from 'react';

const WS_URL =
  process.env.NEXT_PUBLIC_REALTIME_URL ??
  'wss://realtime-service-production-9630.up.railway.app';

export interface WalletUpdatedEvent {
  type:   'wallet.updated';
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

  const getToken = (): string | null =>
    typeof window !== 'undefined'
      ? localStorage.getItem('tec_access_token')
      : null;

  const getUserId = (): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('tec_user');
      if (!raw) return null;
      const u = JSON.parse(raw);
      return u?.id ?? u?.uid ?? null; // ← id أولاً ثم uid
    } catch { return null; }
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

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    const token  = getToken();
    const userId = getUserId();
    if (!token || !userId) return;

    cleanup();

    const url = `${WS_URL}/wallet?token=${token}&userId=${userId}`;
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retryRef.current = 0;
      setIsConnected(true);
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
      } catch { /* ignore */ }
    };

    ws.onerror = () => { /* handled in onclose */ };

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
    return () => { mountedRef.current = false; cleanup(); };
  }, [enabled, connect, cleanup]);

  return { isConnected };
}
