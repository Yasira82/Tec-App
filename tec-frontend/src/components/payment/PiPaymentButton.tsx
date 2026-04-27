'use client';

import { useState, useEffect, useCallback } from 'react';
import { loginWithPi } from '@/lib-client/pi/pi-auth';

export default function PiPaymentButton() {
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
    // ✅ لو جاهز بالفعل
    if (window.__TEC_PI_READY) { setSdkReady(true); return; }

    const onReady = () => setSdkReady(true);
    window.addEventListener('tec-pi-ready', onReady);

    // ✅ polling كل 300ms لمدة 30 ثانية
    const poll = setInterval(() => {
      if (window.__TEC_PI_READY) {
        setSdkReady(true);
        clearInterval(poll);
      }
    }, 300);

    // ✅ بعد 30 ثانية — لو Pi موجود اعتبره ready
    const timeout = setTimeout(() => {
      clearInterval(poll);
      if (typeof window.Pi !== 'undefined') {
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
    // ✅ لو دوس وـ SDK مش ready — جرب تـ check تاني
    if (!sdkReady) {
      if (window.__TEC_PI_READY) {
        setSdkReady(true);
        return; // يضغط تاني
      }
      if (typeof window.Pi !== 'undefined') {
        setSdkReady(true);
        return; // يضغط تاني
      }
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
      if (
        message.includes('not initialized') ||
        message.includes('Pi Browser') ||
        message.includes('init')
      ) {
        // ✅ SDK موجود بس مش initialized — reset وخلّي يحاول تاني
        window.__TEC_PI_READY = false;
        setSdkReady(false);
        setError('Tap again to connect');
      } else {
        setError(message);
      }
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
