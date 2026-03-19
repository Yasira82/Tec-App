'use client';

import { useEffect, useState } from 'react';
import { identitySdk } from '@/lib/sdk';

export default function TestIdentityPage() {
  const [me, setMe] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    identitySdk.getMe()
      .then(setMe)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Identity Test</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {me && <pre>{JSON.stringify(me, null, 2)}</pre>}
    </div>
  );
}
