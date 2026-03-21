'use client';

import { useState } from 'react';

const GATEWAY = 'https://api-gateway-production-6a68.up.railway.app';

export default function TestAnalyticsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const call = async (path: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${GATEWAY}/api/analytics${path}`);
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: 'monospace' }}>
      <h1>📊 Analytics Test</h1>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <button onClick={() => call('/overview')} disabled={loading}>
          1️⃣ Overview
        </button>
        <button onClick={() => call('/payments')} disabled={loading}>
          2️⃣ Payments
        </button>
        <button onClick={() => call('/users')} disabled={loading}>
          3️⃣ Users
        </button>
        <button onClick={() => call('/events')} disabled={loading}>
          4️⃣ Events
        </button>
      </div>

      {loading && <p>⏳ Loading...</p>}
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
