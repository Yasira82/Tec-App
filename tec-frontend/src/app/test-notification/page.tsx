'use client';

import { useState, useEffect } from 'react';

const GATEWAY = 'https://api-gateway-production-6a68.up.railway.app';

export default function TestNotificationPage() {
  const [loading, setLoading]   = useState(false);
  const [result,  setResult]    = useState<any>(null);
  const [error,   setError]     = useState<string | null>(null);
  const [token,   setToken]     = useState('');
  const [userId,  setUserId]    = useState('');

  useEffect(() => {
    const t = localStorage.getItem('tec_access_token') ?? '';
    const raw = localStorage.getItem('tec_user');
    let u: any = null;
    try { u = raw ? JSON.parse(raw) : null; } catch {}
    setToken(t);
    setUserId(u?.id ?? u?.uid ?? '');
  }, []);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization:  `Bearer ${token}`,
  };

  const call = async (method: string, path: string, body?: any) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${GATEWAY}/api/notification${path}`, {
        method,
        headers,
        body: method !== 'GET' ? JSON.stringify(body ?? {}) : undefined,
      });
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: 'monospace', fontSize: 13 }}>
      <h1>🔔 Notification Test</h1>
      <p>Token:   {token  ? '✅ موجود' : '❌ مفيش'}</p>
      <p>User ID: {userId ? `✅ ${userId}` : '❌ مفيش'}</p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '20px 0' }}>

        <button onClick={() => call('GET', '')} disabled={loading}>
          1️⃣ Get Notifications
        </button>

        <button onClick={() => call('PATCH', '/read-all')} disabled={loading}>
          2️⃣ Mark All as Read
        </button>

      </div>

      {loading && <p>⏳ Loading...</p>}
      {error   && <p style={{ color: 'red' }}>❌ {error}</p>}
      {result  && (
        <pre style={{
          background: '#111', color: '#0f0',
          padding: 12, overflow: 'auto', maxHeight: 500,
          borderRadius: 8,
        }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
