        'use client';

import { useState, useEffect } from 'react';
import { loginWithPi, isPiBrowser } from '@/lib-client/pi/pi-auth';

export default function PiPaymentButton() {
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [inPiBrowser,   setInPiBrowser]   = useState(false);
  const [checked,       setChecked]       = useState(false);

  // ✅ تحقق client-side بس
  useEffect(() => {
    setInPiBrowser(isPiBrowser());
    setChecked(true);
  }, []);

  const handleAuth = async () => {
    if (!inPiBrowser) return;
    setLoading(true);
    setError(null);
    try {
      const result = await loginWithPi();
      if (result?.success) {
        window.location.href = '/hub';
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
      setLoading(false);
    }
  };

  // لو لسه بيتحقق
  if (!checked) return null;

  // ✅ لو مش Pi Browser — عرض رسالة واضحة بدون زرار
  if (!inPiBrowser) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{
          fontSize: 11, color: '#4a4a5a', textAlign: 'center',
          letterSpacing: '0.15em', textTransform: 'uppercase',
        }}>
          Open in Pi Browser to sign in
        </div>
        <a href="pi://tec-app.vercel.app"
          style={{
            fontSize: 11, color: '#d4af37', textDecoration: 'none',
            letterSpacing: '0.25em', textTransform: 'uppercase',
          }}>
          Open Pi Browser →
        </a>
      </div>
    );
  }

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
