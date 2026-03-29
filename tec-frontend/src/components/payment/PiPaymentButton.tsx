'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginWithPi } from '@/lib-client/pi/pi-auth';

export default function PiPaymentButton() {
  const router  = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithPi();
      router.push('/hub');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <button
        onClick={handleAuth}
        disabled={loading}
        style={{
          background:    'linear-gradient(135deg, #d4af37 0%, #f5d76e 40%, #b8882a 100%)',
          boxShadow:     '0 0 32px rgba(212,175,55,0.35), 0 4px 16px rgba(0,0,0,0.4)',
          letterSpacing: '0.15em',
        }}
        className="
          relative w-full
          text-[#0a0800] font-black
          py-4 px-6 rounded-2xl
          text-base uppercase
          transition-all duration-300
          hover:brightness-110 hover:scale-[1.02]
          active:scale-[0.98]
          disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100
          overflow-hidden
        "
      >
        <span
          className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
            transform:  'skewX(-20deg)',
          }}
        />
        <span className="relative flex items-center justify-center gap-3">
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: '22px', fontFamily: 'serif', lineHeight: 1 }}>π</span>
              <span>Sign in with Pi</span>
            </>
          )}
        </span>
      </button>

      {error && (
        <p className="text-sm text-red-400 font-medium text-center">
          {error}
        </p>
      )}
    </div>
  );
}
