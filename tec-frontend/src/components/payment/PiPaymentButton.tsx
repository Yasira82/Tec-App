'use client';

import { useState, useEffect, useCallback } from 'react';
import { loginWithPi } from '@/lib-client/pi/pi-auth';
import { PiRuntime }  from '@/lib-client/pi/PiRuntime';

export default function PiPaymentButton() {
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
    if (window.__TEC_PI_READY) { setSdkReady(true); return; }

    const onReady = () => setSdkReady(true);
    window.addEventListener('tec-pi-ready', onReady);

    const poll = setInterval(() => {
      if (window.__TEC_PI_READY) {
        setSdkReady(true);
        clearInterval(poll);
      }
    }, 300);

    const timeout = setTimeout(() => {
      clearInterval(poll);
      if (PiRuntime.isAvailable()) {
        setSdkReady(true);
      }
    }, 30000);

    return () => {
      window.removeEventListener('tec-pi-ready', onReady);
      clearInterval(poll);
      clearTimeout(timeout);
    };
  }, []);

  const handleAuth = useCallback(async () => {
    if (!sdkReady) {
      if (window.__TEC_PI_READY) { setSdkReady(true); return; }
      if (PiRuntime.isAvailable()) { setSdkReady(true); return; }
      setError('Please open in Pi Browser');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await loginWithPi();
if (result?.success) {
  const params   = new URLSearchParams(window.location.search);
  const returnTo = params.get('returnTo');
  const redirect = params.get('redirect'); // ✅ للـ hub/pay

  if (redirect) {
    window.location.href = redirect;
  } else if (returnTo) {
    window.location.href = `/api/auth/sso?target=${encodeURIComponent(returnTo)}`;
  } else {
    window.location.href = '/hub';
  }
}
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';

      if (
        message.includes('not initialized') ||
        message.includes('failed to load') ||
        message.includes('init')
      ) {
        window.location.reload();
        return;
      }

      if (message.includes('Pi Browser')) {
        setError('Please open in Pi Browser');
        setLoading(false);
        return;
      }

      setError(message);
      setLoading(false);
    }
  }, [sdkReady]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <button
        onClick={handleAuth}
        disabled={loading}
        style={{
          background:    'transparent',
          border:        'none',
          letterSpacing: '0.25em',
          color:         sdkReady ? '#d4af37' : '#4a4a5a',
          fontSize:      '11px',
          fontWeight:    400,
          cursor:        loading ? 'not-allowed' : 'pointer',
          padding:       '4px 8px',
          opacity:       loading ? 0.6 : 1,
          textTransform: 'uppercase',
          fontFamily:    'inherit',
        }}>
        {loading
          ? 'Connecting...'
          : sdkReady
            ? 'Sign in with Pi'
            : 'Loading...'}
      </button>
      {error && (
        <p style={{ fontSize: 11, color: '#e74c3c', textAlign: 'center' }}>{error}</p>
      )}
    </div>
  );
}
