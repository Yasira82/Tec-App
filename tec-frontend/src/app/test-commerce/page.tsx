'use client';

import { useState, useEffect } from 'react';

const GATEWAY = 'https://api-gateway-production-6a68.up.railway.app';

export default function TestCommercePage() {
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<any>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    // نشوف كل اللي في localStorage
    const token   = localStorage.getItem('tec_access_token');
    const refresh = localStorage.getItem('tec_refresh_token');
    const rawUser = localStorage.getItem('tec_user');

    let parsedUser = null;
    try { parsedUser = rawUser ? JSON.parse(rawUser) : null; } catch {}

    setDebugInfo({
      hasToken:    !!token,
      hasRefresh:  !!refresh,
      rawUser,
      parsedUser,
      // نجرب كل الـ keys الممكنة للـ id
      uid:  parsedUser?.uid,
      id:   parsedUser?.id,
      _id:  parsedUser?._id,
      piUid: parsedUser?.piUid,
      userId: parsedUser?.userId,
      pi_uid: parsedUser?.pi_uid,
    });
  }, []);

  const getToken  = () => localStorage.getItem('tec_access_token') ?? '';
  const getUserId = () => {
    try {
      const raw  = localStorage.getItem('tec_user');
      const user = raw ? JSON.parse(raw) : {};
      // نجرب كل الـ keys الممكنة
      return user?.uid ?? user?.id ?? user?._id ?? user?.piUid ?? user?.userId ?? '';
    } catch { return ''; }
  };

  const call = async (method: string, path: string, body?: any) => {
    setLoading(true);
    setError(null);
    const token  = getToken();
    const userId = getUserId();

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

  const userId = getUserId();

  return (
    <div style={{ padding: 20, fontFamily: 'monospace', fontSize: 13 }}>
      <h1>🛒 Commerce Test</h1>

      {/* Debug Info */}
      <div style={{ background: '#111', color: '#aaa', padding: 12, marginBottom: 20, borderRadius: 8 }}>
        <strong style={{ color: '#fff' }}>Debug Info:</strong>
        <pre style={{ margin: '8px 0 0', fontSize: 12 }}>
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      </div>

      <p>Token:   {getToken()  ? '✅ موجود' : '❌ مفيش'}</p>
      <p>User ID: {userId ? `✅ ${userId}` : '❌ مفيش — شوف Debug Info فوق'}</p>

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
            headers: { Authorization: `Bearer ${getToken()}` },
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
