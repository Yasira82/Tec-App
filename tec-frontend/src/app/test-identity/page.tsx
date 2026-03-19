'use client';

import { useEffect, useState } from 'react';
import { identitySdk } from '@/lib/sdk';
import { loginWithPi } from '@/lib-client/pi/pi-auth';

export default function TestIdentityPage() {
  const [me, setMe] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('tec_access_token');
    setToken(t);
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      // ✅ امسح القديم
      localStorage.removeItem('tec_access_token');
      localStorage.removeItem('tec_refresh_token');

      await loginWithPi();
      const result = await identitySdk.getMe();
      setMe(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGetMe = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await identitySdk.getMe();
      setMe(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: 'monospace' }}>
      <h1>Identity Test</h1>

      <p>Token: {token ? '✅ موجود' : '❌ مفيش'}</p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button onClick={handleLogin} disabled={loading}>
          🔑 Login with Pi
        </button>
        <button onClick={handleGetMe} disabled={loading || !token}>
          👤 Get Me
        </button>
        <button onClick={() => {
          localStorage.clear();
          setToken(null);
          setMe(null);
          setError(null);
        }}>
          🗑️ Clear Token
        </button>
      </div>

      {loading && <p>⏳ Loading...</p>}
      {error && <p style={{ color: 'red' }}>❌ {error}</p>}
      {me && (
        <pre style={{ background: '#111', color: '#0f0', padding: 10 }}>
          {JSON.stringify(me, null, 2)}
        </pre>
      )}
    </div>
  );
}
