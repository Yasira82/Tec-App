'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { getAccessToken, getStoredUser } from '@/lib-client/pi/pi-auth';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WalletUpdatedEvent {
  userId:     string;
  balance:    number;
  currency:   string;
  txId:       string;
  amount:     number;
  type:       'credit' | 'debit';
  timestamp:  string;
}

interface UseWalletRealtimeOptions {
  onBalanceUpdate: (event: WalletUpdatedEvent) => void;
  onConnect?:      () => void;
  onDisconnect?:   () => void;
}

interface UseWalletRealtimeReturn {
  isConnected: boolean;
  lastEvent:   WalletUpdatedEvent | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REALTIME_URL = 'https://realtime-service-production-9630.up.railway.app';
const RECONNECT_DELAY  = 3000;  // 3 ثواني
const MAX_RECONNECTS   = 5;

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useWalletRealtime({
  onBalanceUpdate,
  onConnect,
  onDisconnect,
}: UseWalletRealtimeOptions): UseWalletRealtimeReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent]     = useState<WalletUpdatedEvent | null>(null);

  const wsRef          = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted      = useRef(true);

  const connect = useCallback(() => {
    if (!isMounted.current) return;

    const token = getAccessToken();
    const user  = getStoredUser();

    if (!token || !user?.id) return;

    // مش هنفتح connection لو في واحد مفتوح
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // أضيف الـ token في الـ URL (Realtime Service بياخده من query)
    const url = `${REALTIME_URL.replace('https', 'wss')}/wallet?token=${token}&userId=${user.id}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      // ── Open ──
      ws.onopen = () => {
        if (!isMounted.current) return;
        setIsConnected(true);
        reconnectCount.current = 0;
        onConnect?.();
      };

      // ── Message ──
      ws.onmessage = (event) => {
        if (!isMounted.current) return;
        try {
          const data = JSON.parse(event.data);

          // Realtime Service بيبعت event نوع wallet.updated
          if (data?.type === 'wallet.updated' && data?.payload) {
            const walletEvent: WalletUpdatedEvent = {
              userId:    data.payload.userId,
              balance:   data.payload.balance,
              currency:  data.payload.currency ?? 'PI',
              txId:      data.payload.txId,
              amount:    data.payload.amount,
              type:      data.payload.type,
              timestamp: data.payload.timestamp ?? new Date().toISOString(),
            };
            setLastEvent(walletEvent);
            onBalanceUpdate(walletEvent);
          }

          // Ping/Pong للـ keep-alive
          if (data?.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          }

        } catch {
          // Invalid JSON — ignore
        }
      };

      // ── Close ──
      ws.onclose = (event) => {
        if (!isMounted.current) return;
        setIsConnected(false);
        onDisconnect?.();

        // Reconnect لو مش intentional close
        if (event.code !== 1000 && reconnectCount.current < MAX_RECONNECTS) {
          reconnectCount.current += 1;
          reconnectTimer.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY * reconnectCount.current); // exponential backoff بسيط
        }
      };

      // ── Error ──
      ws.onerror = () => {
        ws.close();
      };

    } catch (err) {
      console.error('[useWalletRealtime] WebSocket error:', err);
    }
  }, [onBalanceUpdate, onConnect, onDisconnect]);

  useEffect(() => {
    isMounted.current = true;
    connect();

    return () => {
      isMounted.current = false;

      // Clear reconnect timer
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }

      // Close WebSocket cleanly
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { isConnected, lastEvent };
}
