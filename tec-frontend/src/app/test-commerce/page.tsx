'use client';

import { useState } from 'react';

const GATEWAY = 'https://api-gateway-production-6a68.up.railway.app';

export default function TestCommercePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const token = typeof window !== 'undefined'
    ? localStorage.getItem('tec_access_token')
    : null;

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const call = async (method: string, path: string, body?: any) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${GATEWAY}/api/commerce${path}`, {
        method,
        headers: authHeaders,
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
    <div style={{ padding: 20, fontFamily: 'monospace' }}>
      <h1>🛒 Commerce Test</h1>
      <p>Token: {token ? '✅ موجود' : '❌ مفيش'}</p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <button onClick={() => call('GET', '/products')} disabled={loading}>
          1️⃣ Get Products
        </button>
        <button onClick={() => call('POST', '/products', {
          title: 'Test Product',
          description: 'This is a test product',
          price: 10,
          stock: 100,
          category: 'test',
        })} disabled={loading}>
          2️⃣ Create Product
        </button>
        <button onClick={() => call('GET', '/orders')} disabled={loading}>
          3️⃣ Get Orders
        </button>
      </div>

      {loading && <p>⏳ Loading...</p>}
      {error && <p style={{ color: 'red' }}>❌ {error}</p>}
      {result && (
        <pre style={{
          background: '#111',
          color: '#0f0',
          padding: 10,
          overflow: 'auto',
          maxHeight: 400,
        }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
