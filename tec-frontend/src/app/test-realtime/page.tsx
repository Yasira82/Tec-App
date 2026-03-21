'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const REALTIME_URL = 'https://realtime-service-production-9630.up.railway.app';

export default function TestRealtimePage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<any[]>([]);

  const token = typeof window !== 'undefined'
    ? localStorage.getItem('tec_access_token')
    : null;

  const connect = () => {
    const s = io(REALTIME_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    s.on('connected', (data) => {
      setConnected(true);
      setEvents(prev => [...prev, { event: 'connected', data }]);
    });

    s.on('wallet.updated', (data) => {
      setEvents(prev => [...prev, { event: 'wallet.updated', data }]);
    });

    s.on('notification.new', (data) => {
      setEvents(prev => [...prev, { event: 'notification.new', data }]);
    });

    s.on('disconnect', () => {
      setConnected(false);
    });

    setSocket(s);
  };

  const disconnect = () => {
    socket?.disconnect();
    setSocket(null);
    setConnected(false);
  };

  useEffect(() => {
    return () => { socket?.disconnect(); };
  }, [socket]);

  return (
    <div style={{ padding: 20, fontFamily: 'monospace' }}>
      <h1>⚡ Realtime Test</h1>
      <p>Token: {token ? '✅ موجود' : '❌ مفيش'}</p>
      <p>Status: {connected ? '🟢 Connected' : '🔴 Disconnected'}</p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button onClick={connect} disabled={connected || !token}>
          🔌 Connect
        </button>
        <button onClick={disconnect} disabled={!connected}>
          ❌ Disconnect
        </button>
        <button onClick={() => setEvents([])}>
          🗑️ Clear
        </button>
      </div>

      <h3>Events:</h3>
      <pre style={{
        background: '#111',
        color: '#0f0',
        padding: 10,
        overflow: 'auto',
        maxHeight: 400,
      }}>
        {events.length === 0
          ? 'مفيش events بعد...'
          : JSON.stringify(events, null, 2)}
      </pre>
    </div>
  );
}
