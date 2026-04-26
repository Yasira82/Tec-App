'use client';

import { useState, useEffect } from 'react';
import { loginWithPi }         from '@/lib-client/pi/pi-auth';

export default function PiPaymentButton() {
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [sdkReady,    setSdkReady]    = useState(false);

  // ✅ انتظر Pi SDK يكون ready
  useEffect(() => {
    const check = () => {
      if (window.__TEC_PI_READY) { setSdkReady(true); return; }
      if (window.__TEC_PI_ERROR) { setSdkReady(false); return; }
    };

    check();

    window.addEventListener('tec-pi-ready', () => setSdkReady(true));
    window.addEventListener('tec-pi-error', () => setSdkReady(false));

    return () => {
      window.removeEventListener('tec-pi-ready', () => setSdkReady(true));
      window.removeEventListener('tec-pi-error', () => setSdkReady(false));
    };
  }, []);

  const handleAuth = async () => {
    if (!sdkReady) {
      setError('Please open in Pi Browser');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await loginWithPi();
      if (result?.success) {
        window.location.href = '/hub';
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message.includes('Pi Browser') ? 'Please open in Pi Browser' : message);
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <button
        onClick={handleAuth}
        disabled={loading || !sdkReady}
        style={{
          background:    'transparent',
          border:        'none',
          letterSpacing: '0.25em',
          color:         sdkReady ? '#d4af37' : '#4a4a5a',
          fontSize:      '11px',
          fontWeight:    400,
          cursor:        (loading || !sdkReady) ? 'not-allowed' : 'pointer',
          padding:       '4px 8px',
          opacity:       (loading || !sdkReady) ? 0.6 : 1,
          textTransform: 'uppercase',
          fontFamily:    'inherit',
        }}>
        {loading ? 'Connecting...' : sdkReady ? 'Sign in with Pi' : 'Loading...'}
      </button>
      {error && (
        <p style={{ fontSize: 11, color: '#e74c3c', textAlign: 'center' }}>{error}</p>
      )}
    </div>
  );
}
