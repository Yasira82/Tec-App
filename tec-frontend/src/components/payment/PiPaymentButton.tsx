'use client';

import { useState, useEffect, useCallback } from 'react';
import { loginWithPi } from '@/lib-client/pi/pi-auth';

export default function PiPaymentButton() {
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
  if (window.__TEC_PI_READY) { setSdkReady(true); return; }

  const onReady = () => setSdkReady(true);
  window.addEventListener('tec-pi-ready', onReady);

  // ✅ polling كل 300ms لمدة 30 ثانية
  const poll = setInterval(() => {
    if (window.__TEC_PI_READY) {
      setSdkReady(true);
      clearInterval(poll);
    } else if (typeof window.Pi !== 'undefined' && !window.__TEC_PI_READY) {
      // Pi موجود بس مش initialized بعد — استنى
    }
  }, 300);

  const timeout = setTimeout(() => {
    clearInterval(poll);
    // ✅ لو Pi موجود بس __TEC_PI_READY مش set — جرب init
    if (typeof window.Pi !== 'undefined' && !window.__TEC_PI_READY) {
      setSdkReady(true); // optimistic
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
      setError(
        message.includes('Pi Browser') || message.includes('not initialized')
          ? 'Please open in Pi Browser'
          : message
      );
      setLoading(false);
    }
  }, [sdkReady]);

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
