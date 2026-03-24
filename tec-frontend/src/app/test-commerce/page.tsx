'use client';

import { useState, useEffect } from 'react';

const GATEWAY = 'https://api-gateway-production-6a68.up.railway.app';

export default function TestCommercePage() {
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState<any>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [userId,    setUserId]    = useState('');
  const [token,     setToken]     = useState('');

  useEffect(() => {
    const t = localStorage.getItem('tec_access_token') ?? '';
    const rawUser = localStorage.getItem('tec_user');
    let u: any = null;
    try { u = rawUser ? JSON.parse(rawUser) : null; } catch {}
    setToken(t);
    setUserId(u?.id ?? u?.uid ?? '');
  }, []);

  // ← فقط Authorization header — بدون x-user-id
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization:  `Bearer ${token}`,
  };

  const call = async (method: string, path: string, body?: any) => {
    setLoading(true);
    setError(null);
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

        {/* ← buyer_id في الـ query string بدل header */}
        <button onClick={() => call('GET', `/orders?buyer_id=${userId}`)} disabled={loading || !userId}>
          3️⃣ Get Orders
        </button>

        <button onClick={async () => {
          const pRes  = await fetch(`${GATEWAY}/api/commerce/products`, { headers });
          const pData = await pRes.json();
          const pid   = pData?.data?.products?.[0]?.id;
          if (!pid) { setError('No products — create one first'); return; }

          // ← buyer_id في الـ body
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
