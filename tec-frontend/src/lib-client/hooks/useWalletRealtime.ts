'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { getAccessToken, getStoredUser } from '@/lib-client/pi/pi-auth';
import { sessionToken, sessionUserId } from '@/lib-client/pi/session-source';

/**
 * Live wallet updates from tec-realtime-service.
 *
 * The service is a NestJS **Socket.IO** gateway (@nestjs/platform-socket.io). An
 * earlier version of this hook opened a RAW `new WebSocket(...)` against it and sent
 * `{type:'auth'}` as a first message — two protocols that cannot talk to each other.
 * Socket.IO performs its own handshake over /socket.io/, and the server reads the
 * token from `handshake.auth.token`, disconnecting immediately when it is absent.
 * So the connection could never succeed, no matter how the URL was configured.
 *
 * This now mirrors useRealtimeNotifications, which was already doing it correctly:
 * socket.io-client, token in `auth`, and the server's own event names. Reconnection
 * is handled by socket.io itself rather than a hand-rolled backoff loop.
 *
 * The service URL comes from the BFF (/api/bff/realtime), never a NEXT_PUBLIC_ var —
 * an internal Railway host must not be inlined into the client bundle (NEW-A).
 */
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

type Socket = { on: (e: string, cb: (...a: unknown[]) => void) => void; disconnect: () => void };

export function useWalletRealtime({
  onBalanceUpdate,
  onNewTx,
  enabled = true,
}: UseWalletRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false);
  // Whether live updates are CONFIGURED at all (REALTIME_URL set on the server).
  // Without this the UI cannot tell "the feature is off" from "the connection
  // dropped" — and it showed a scary "Offline" badge for the former, next to a
  // balance that had loaded perfectly. null = not determined yet.
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  const socketRef  = useRef<Socket | null>(null);
  const mountedRef = useRef(true);

  // Keep callbacks in refs so `connect` does NOT depend on them. Callers commonly
  // pass inline functions; if `connect` depended on them it would be recreated every
  // render, re-running the connect effect and re-fetching /api/bff/realtime each time
  // (a request storm onto the gateway). Refs make connect stable across renders.
  const onBalanceUpdateRef = useRef(onBalanceUpdate);
  const onNewTxRef         = useRef(onNewTx);
  useEffect(() => { onBalanceUpdateRef.current = onBalanceUpdate; }, [onBalanceUpdate]);
  useEffect(() => { onNewTxRef.current = onNewTx; }, [onNewTx]);

  const cleanup = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const connect = useCallback(async () => {
    if (!mountedRef.current || socketRef.current) return;

    // ✅ P1-2: token from the cookie, not localStorage.
    const token  = sessionToken();
    const userId = sessionUserId();
    if (!token || !userId) return;

    // ✅ P1: service URL from the BFF — no NEXT_PUBLIC_ env var (NEW-A).
    let baseUrl: string;
    try {
      const res = await fetch('/api/bff/realtime');
      if (!res.ok) return;
      const data = await res.json() as { url: string | null; enabled?: boolean };
      if (!data.url) { setIsAvailable(false); return; }   // realtime not configured
      setIsAvailable(true);
      baseUrl = data.url;
    } catch {
      return;
    }
    if (!mountedRef.current) return;

    try {
      const { io } = await import('socket.io-client');
      if (!mountedRef.current) return;

      // ✅ P1-7: the token travels in the handshake `auth`, never in the URL —
      // which is also exactly where this server looks for it.
      const socket = io(baseUrl, {
        auth:                 { token },
        transports:           ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay:    2000,
        timeout:              10000,
      }) as unknown as Socket;

      socket.on('connect',    () => setIsConnected(true));
      socket.on('disconnect', () => setIsConnected(false));

      // The server routes to a room named after the userId and emits these names.
      socket.on('wallet.updated', (...args: unknown[]) => {
        const data = args[0] as Partial<WalletUpdatedEvent> | undefined;
        if (!data) return;
        onBalanceUpdateRef.current({ ...data, type: 'wallet.updated' } as WalletUpdatedEvent);
        onNewTxRef.current?.();
      });

      socketRef.current = socket;
    } catch {
      /* socket.io-client unavailable — stay disconnected, never crash the page */
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) connect();
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [enabled, connect, cleanup]);

  return { isConnected, isAvailable };
}
