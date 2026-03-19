'use client';

import { useEffect, useState } from 'react';
import { identitySdk } from '@/lib/sdk';
import { loginWithPi } from '@/lib-client/pi/pi-auth';

export default function TestIdentityPage() {
  const [me, setMe] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await loginWithPi();
      const result = await identitySdk.getMe();
      setMe(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // لو في token موجود جرب مباشرة
    const token = localStorage.getItem('tec_access_token');
    if (token) {
      identitySdk.getMe()
        .then(setMe)
        .catch(() => setError('Token expired — please login again'));
    }
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Identity Test</h1>
      <button onClick={handleLogin} disabled={loading}>
        {loading ? 'Loading...' : 'Login with Pi'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {me && <pre>{JSON.stringify(me, null, 2)}</pre>}
    </div>
  );
}
