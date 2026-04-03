'use client';

import { useState }      from 'react';
import { useRouter }     from 'next/navigation';
import { loginWithPi }   from '@/lib-client/pi/pi-auth';

export default function PiPaymentButton() {
  const router              = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loginWithPi();

      if (result?.success) {
        // ✅ استخدم window.location بدل router.push
        // عشان يعمل full page reload ويقرأ الـ cookies الجديدة
        window.location.href = '/hub';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-3">
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
        }}
      >
        {loading ? 'Connecting...' : 'Sign in with Pi'}
      </button>
      {error && (
        <p style={{ fontSize: 11, color: '#e74c3c', textAlign: 'center' }}>{error}</p>
      )}
    </div>
  );
}
