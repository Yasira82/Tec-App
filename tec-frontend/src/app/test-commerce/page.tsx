'use client';

import { useState, useEffect } from 'react';

const GATEWAY = 'https://api-gateway-production-6a68.up.railway.app';

export default function TestCommercePage() {
  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState<any>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [debugInfo,  setDebugInfo]  = useState<any>(null);
  const [userId,     setUserId]     = useState('');
  const [token,      setToken]      = useState('');

  useEffect(() => {
    const t       = localStorage.getItem('tec_access_token') ?? '';
    const rawUser = localStorage.getItem('tec_user');
    let parsedUser: any = null;
    try { parsedUser = rawUser ? JSON.parse(rawUser) : null; } catch {}

    const uid = parsedUser?.id ?? parsedUser?.uid ?? '';

    setToken(t);
    setUserId(uid);
    setDebugInfo({ hasToken: !!t, rawUser, parsedUser });
  }, []);

  const call = async (method: string, path: string, body?: any) => {
    setLoading(true);
    setError(null);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${token}`,
    };
    if (userId) headers['x-user-id'] = userId;

    try {
      const res = await fetch(`${GATEWAY}/api/commerce${path}`, {
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
      <h1>🛒 Commerce Test</h1>

      <div style={{ background: '#111', color: '#aaa', padding: 12, marginBottom: 20, borderRadius: 8 }}>
        <strong style={{ color: '#fff' }}>Debug Info:</strong>
        <pre style={{ margin: '8px 0 0', fontSize: 12 }}>
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      </div>

      <p>Token:   {token  ? '✅ موجود' : '❌ مفيش'}</p>
      <p>User ID: {userId ? `✅ ${userId}` : '❌ مفيش'}</p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '20px 0' }}>
        <button onClick={() => call('GET', '/products')} disabled={loading}>
          1️⃣ Get Products
        </button>
        <button onClick={() => call('POST', '/products', {
          title: 'Test Product', description: 'Test', price: 10, stock: 100, category: 'test',
        })} disabled={loading}>
          2️⃣ Create Product
        </button>
        <button onClick={() => call('GET', '/orders')} disabled={loading}>
          3️⃣ Get Orders
        </button>
        <button onClick={async () => {
          const pRes  = await fetch(`${GATEWAY}/api/commerce/products`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const pData = await pRes.json();
          const pid   = pData?.data?.products?.[0]?.id;
          if (!pid) { setError('No products — create one first'); return; }
          await call('POST', '/orders', {
            buyer_id: userId,
            items: [{ product_id: pid, quantity: 1 }],
          });
        }} disabled={loading || !userId}>
          4️⃣ Create Order
        </button>
      </div>

      {loading && <p>⏳ Loading...</p>}
      {error   && <p style={{ color: 'red' }}>❌ {error}</p>}
      {result  && (
        <pre style={{ background: '#111', color: '#0f0', padding: 10, overflow: 'auto', maxHeight: 400 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
