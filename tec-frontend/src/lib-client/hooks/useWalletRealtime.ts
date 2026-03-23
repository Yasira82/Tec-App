'use client';
import { useEffect, useRef, useCallback } from 'react';

// realtime-service-production-9630.up.railway.app
const WS_URL = process.env.NEXT_PUBLIC_REALTIME_URL
  ?? 'wss://realtime-service-production-9630.up.railway.app';

interface WalletUpdatedEvent {
  type:    'wallet.updated';
  balance: number;
  amount:  number;
  txType:  'credit' | 'debit';
  txId:    string;
}

interface UseWalletRealtimeOptions {
  userId:          string | null;
  onBalanceUpdate: (newBalance: number) => void;
  onNewTx?:        () => void; // optional: re-fetch list
  enabled?:        boolean;
}

const MAX_RETRIES    = 5;
const PING_INTERVAL  = 25_000; // 25s
const BACKOFF_BASE   = 1_000;  // 1s base

export function useWalletRealtime({
  userId,
  onBalanceUpdate,
  onNewTx,
  enabled = true,
}: UseWalletRealtimeOptions) {
  const wsRef      = useRef<WebSocket | null>(null);
  const retryRef   = useRef(0);
  const pingRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const getToken = (): string | null =>
    typeof window !== 'undefined'
      ? localStorage.getItem('tec_access_token')
      : null;

  // ── Cleanup helper ──────────────────────────────────────
  const cleanup = useCallback(() => {
    if (pingRef.current) clearInterval(pingRef.current);
    if (wsRef.current) {
      wsRef.current.onclose = null; // no retry on intentional close
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // ── Connect ─────────────────────────────────────────────
  const connect = useCallback(() => {
    if (!mountedRef.current || !userId) return;

    const token = getToken();
    if (!token) return;

    cleanup();

    // Token يتبعت في الـ URL لأن WebSocket مش بيدعم custom headers
    const url = `${WS_URL}/wallet?token=${token}&userId=${userId}`;
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retryRef.current = 0; // reset retries on success

      // Ping/Pong keep-alive
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, PING_INTERVAL);
    };

    ws.onmessage = (e: MessageEvent) => {
      try {
        const data: WalletUpdatedEvent | { type: 'pong' } = JSON.parse(e.data);

        if (data.type === 'wallet.updated') {
          onBalanceUpdate(data.balance);
          onNewTx?.(); // optional: re-fetch transactions list
        }
        // pong → نتجاهله، الـ ping/pong keep-alive تلقائي
      } catch {
        // invalid JSON — ignore
      }
    };

    ws.onerror = () => {
      // onerror دايماً بييجي قبل onclose — نتجاهله هنا
    };

    ws.onclose = () => {
      if (pingRef.current) clearInterval(pingRef.current);
      if (!mountedRef.current) return;

      // Exponential backoff retry
      if (retryRef.current < MAX_RETRIES) {
        const delay = BACKOFF_BASE * Math.pow(2, retryRef.current);
        retryRef.current += 1;
        setTimeout(connect, delay);
      }
      // بعد MAX_RETRIES: نوقف المحاولات بهدوء
    };
  }, [userId, onBalanceUpdate, onNewTx, cleanup]);

  // ── Mount / Unmount ─────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    if (enabled && userId) connect();

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [enabled, userId, connect, cleanup]);
}
