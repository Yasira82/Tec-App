'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef } from 'react';
import { usePiSdkReady }     from '@/lib-client/hooks/usePiSdkReady';
import { usePiAuth }         from '@/lib-client/hooks/usePiAuth';
import { loginWithPi }       from '@/lib-client/pi/pi-auth';

export default function AuthBootstrapPage() {
  const { piReady }         = usePiSdkReady();
  const { isAuthenticated } = usePiAuth();
  const started             = useRef(false);

  const getReturnUrl = (): string | null => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('return_url');
  };

  const redirectWithSso = (returnUrl: string) => {
    const ssoUrl = new URL('/api/auth/sso', window.location.origin);
    ssoUrl.searchParams.set('target', returnUrl);
    window.location.href = ssoUrl.toString();
  };

  // ✅ عنده session → SSO مباشرة
  useEffect(() => {
    if (!isAuthenticated) return;
    const returnUrl = getReturnUrl();
    if (returnUrl) redirectWithSso(returnUrl);
  }, [isAuthenticated]);

  // ✅ مفيش session → Pi login
  useEffect(() => {
    if (!piReady || isAuthenticated || started.current) return;
    started.current = true;
    loginWithPi().catch(() => {
      const returnUrl = getReturnUrl();
      if (returnUrl) window.location.href = returnUrl;
    });
  }, [piReady, isAuthenticated]);

  return (
    <div style={{
      minHeight: '100vh', background: '#050816',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: 'var(--tec-gold)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24, fontWeight: 900, color: '#0a0800',
      }}>T</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          border: '2px solid rgba(var(--tec-gold-rgb),0.2)',
          borderTopColor: 'var(--tec-gold)',
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ fontSize: 13, color: '#4a4a5a' }}>
          {!piReady ? 'Loading Pi SDK...' : 'Authenticating...'}
        </span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
