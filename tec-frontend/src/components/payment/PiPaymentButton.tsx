'use client';

import { useState }    from 'react';
import { loginWithPi } from '@/lib-client/pi/pi-auth';

export default function PiPaymentButton() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loginWithPi();
      if (result?.success) {
        // ✅ full reload عشان الـ cookies تتطبق
        window.location.href = '/hub';
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      // ✅ لو Pi SDK مش موجود — وضّح للـ user
      if (message.includes('not initialized') || message.includes('Pi Browser')) {
        setError('Please open in Pi Browser');
      } else {
        setError(message);
      }
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <button
        onClick={handleAuth}
        disabled={loading}
        style={{
          background:    'transparent',
          border:        'none',
          letterSpacing: '0.25em',
          color:         '#d4af37',
          fontSize:      '11px',
          fontWeight:    400,
          cursor:        loading ? 'not-allowed' : 'pointer',
          padding:       '4px 8px',
          opacity:       loading ? 0.6 : 1,
          textTransform: 'uppercase',
          fontFamily:    'inherit',
        }}>
        {loading ? 'Connecting...' : 'Sign in with Pi'}
      </button>
      {error && (
        <p style={{ fontSize: 11, color: '#e74c3c', textAlign: 'center' }}>{error}</p>
      )}
    </div>
  );
}
