'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams }                                      from 'next/navigation';
import { usePiAuth }                                            from '@/lib-client/hooks/usePiAuth';
import { usePiSdkReady }                                        from '@/lib-client/hooks/usePiSdkReady';
import { createU2APayment }                                     from '@/lib-client/pi/pi-payment';
import { piSession }                                            from '@/lib-client/pi/pi-session';
import { ErrorBoundary }                                        from '@/components/ErrorBoundary';

const HUB_ORIGIN = 'https://hub.tecosystem.app';

const goToReturn = (returnUrl: string) => {
  window.location.href = returnUrl;
};

const getCsrf = (): string =>
  document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';

function HubPayInner() {
  const params    = useSearchParams();
  const { user, isAuthenticated, isLoading } = usePiAuth();
  const { piReady } = usePiSdkReady();

  const amount    = parseFloat(params.get('amount')     ?? '0');
  const memo      = params.get('memo')       ?? 'TEC Payment';
  const returnUrl = params.get('return_url') ?? 'https://tec-commerce-app.vercel.app/app';
  const productId = params.get('product_id') ?? '';
  const source    = params.get('source')     ?? 'commerce';

  const [status,   setStatus]   = useState<'idle' | 'auth' | 'paying' | 'success' | 'error' | 'cancelled'>('idle');
  const [message,  setMessage]  = useState('');
  const [sdkReady, setSdkReady] = useState(false);
  const hasStarted = useRef(false);

  useEffect(() => {
    const onReady = () => setSdkReady(true);
    const onError = () => {
      // ✅ Pi SDK فشل → احفظ الـ URL وروح لـ /hub عشان يعمل Pi auth
      console.warn('[HubPay] Pi SDK init failed — redirecting to /hub');
      sessionStorage.setItem('post_pi_redirect', window.location.pathname + window.location.search);
      window.location.href = `${HUB_ORIGIN}/hub`;
    };
    window.addEventListener('tec-pi-ready', onReady, { once: true });
    window.addEventListener('tec-pi-error', onError, { once: true });
    if (window.__TEC_PI_READY) setSdkReady(true);
    if (window.__TEC_PI_ERROR) onError();
    return () => {
      window.removeEventListener('tec-pi-ready', onReady);
      window.removeEventListener('tec-pi-error', onError);
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      window.location.href = `${HUB_ORIGIN}/?redirect=${encodeURIComponent(window.location.href)}`;
    }
  }, [isLoading, isAuthenticated]);

  const handlePay = useCallback(async () => {
    if (!window.Pi) { setStatus('error'); setMessage('Open in Pi Browser'); return; }
    if (!amount || amount <= 0) { setStatus('error'); setMessage('Invalid amount'); return; }

    setStatus('auth');
    try {
      await window.Pi.authenticate(['username', 'payments'], () => {});
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('[HubPay] Pi.authenticate error:', errMsg);
      if (errMsg.toLowerCase().includes('not initialized') || errMsg.toLowerCase().includes('init')) {
        // ✅ روح /hub عشان يعمل Pi auth من أول
        sessionStorage.setItem('post_pi_redirect', window.location.pathname + window.location.search);
        window.location.href = `${HUB_ORIGIN}/hub`;
        return;
      }
      setStatus('error');
      setMessage(`Auth: ${errMsg}`);
      return;
    }

    try {
      const refreshRes = await fetch('/api/auth/refresh', {
        method: 'POST', credentials: 'include',
        headers: { 'x-csrf-token': getCsrf() },
      });
      if (!refreshRes.ok) {
        window.location.href = `${HUB_ORIGIN}/?redirect=${encodeURIComponent(window.location.href)}`;
        return;
      }
    } catch {
      window.location.href = `${HUB_ORIGIN}/?redirect=${encodeURIComponent(window.location.href)}`;
      return;
    }

    if (hasStarted.current) return;
    hasStarted.current = true;

    const locked = await piSession.acquirePaymentLock();
    if (!locked) { setStatus('error'); setMessage('Payment already in progress'); return; }

    try {
      await new Promise(r => setTimeout(r, 500));
      setStatus('paying');

      const result = await createU2APayment(
        amount, memo,
        { source, product_id: productId, version: '1.0' },
        (type, msg, data) => console.log(`[HubPay][${type}] ${msg}`, data ?? ''),
      );

      if (result.success && result.status === 'completed') {
        setStatus('success');
        setTimeout(() => {
          const ret = new URL(returnUrl);
          ret.searchParams.set('payment_status', 'success');
          ret.searchParams.set('txid',       result.txid      ?? '');
          ret.searchParams.set('payment_id', result.paymentId ?? '');
          ret.searchParams.set('product_id', productId);
          goToReturn(ret.toString());
        }, 1500);
      } else if (result.status === 'cancelled') {
        setStatus('cancelled');
      } else {
        setStatus('error');
        setMessage(result.message ?? 'Payment failed');
      }
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      piSession.releasePaymentLock();
    }
  }, [piReady, amount, memo, productId, returnUrl, source]);

  if (isLoading || !sdkReady) return (
    <div style={{ minHeight: '100vh', background: '#020205',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ width: 64, height: 64, borderRadius: 20,
        background: 'linear-gradient(135deg,#d4af37,#b8882a)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, fontWeight: 900, color: '#0a0800', marginBottom: 8 }}>T</div>
      <div style={{ width: 32, height: 32, borderRadius: '50%',
        border: '3px solid #d4af3730', borderTop: '3px solid #d4af37',
        animation: 'spin 0.8s linear infinite' }} />
      <div style={{ fontSize: 13, color: '#4a4a5a' }}>Initializing Pi...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh', background: '#020205', color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 360, width: '100%', textAlign: 'center' }}>

        <div style={{ width: 64, height: 64, borderRadius: 20,
          background: 'linear-gradient(135deg,#d4af37,#b8882a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, margin: '0 auto 20px', fontWeight: 900, color: '#0a0800' }}>T</div>

        <div style={{ fontSize: 11, color: '#4a4a5a', letterSpacing: 2,
          textTransform: 'uppercase', marginBottom: 8 }}>TEC Payment</div>
        <div style={{ fontSize: 48, fontWeight: 900, color: '#d4af37', marginBottom: 4 }}>{amount}π</div>
        <div style={{ fontSize: 12, color: '#4a4a5a', marginBottom: 32 }}>{memo}</div>

        {status === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <button onClick={handlePay} style={{
              padding: '18px 48px', borderRadius: 20,
              background: 'linear-gradient(135deg,#d4af37,#b8882a)',
              border: 'none', color: '#0a0800',
              fontSize: 18, fontWeight: 900, cursor: 'pointer',
              boxShadow: '0 8px 32px rgba(212,175,55,0.3)',
            }}>
              Pay {amount}π
            </button>
            <button onClick={() => goToReturn(returnUrl)} style={{
              background: 'none', border: 'none',
              color: '#4a4a5a', fontSize: 12, cursor: 'pointer', marginTop: 4,
            }}>
              Cancel
            </button>
          </div>
        )}

        {(status === 'auth' || status === 'paying') && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%',
              border: '3px solid #d4af3730', borderTop: '3px solid #d4af37',
              animation: 'spin 0.8s linear infinite' }} />
            <div style={{ fontSize: 14, color: '#6b6b7a' }}>
              {status === 'auth' ? 'Authenticating with Pi...' : 'Processing payment...'}
            </div>
          </div>
        )}

        {status === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#7ee7c0' }}>Payment Successful!</div>
            <div style={{ fontSize: 12, color: '#4a4a5a' }}>Redirecting back...</div>
          </div>
        )}

        {status === 'cancelled' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 48 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f0c040' }}>Payment Cancelled</div>
            <button onClick={() => goToReturn(returnUrl)}
              style={{ marginTop: 8, padding: '12px 24px', borderRadius: 14,
                background: '#ffffff10', border: '1px solid #ffffff20',
                color: '#fff', fontSize: 13, cursor: 'pointer' }}>Go Back</button>
          </div>
        )}

        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 48 }}>❌</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e74c3c' }}>Payment Failed</div>
            <div style={{ fontSize: 12, color: '#4a4a5a', marginBottom: 8 }}>{message}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { hasStarted.current = false; setStatus('idle'); }}
                style={{ padding: '12px 24px', borderRadius: 14,
                  background: 'linear-gradient(135deg,#d4af37,#b8882a)',
                  border: 'none', color: '#0a0800', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Try Again
              </button>
              <button onClick={() => goToReturn(returnUrl)}
                style={{ padding: '12px 24px', borderRadius: 14,
                  background: '#ffffff10', border: '1px solid #ffffff20',
                  color: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 40, fontSize: 10, color: '#3a3a4a' }}>
          @{user?.piUsername} · Secured by Pi Network
        </div>
      </div>
    </div>
  );
}

export default function HubPayPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={
        <div style={{ minHeight: '100vh', background: '#020205',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%',
            border: '3px solid #d4af3730', borderTop: '3px solid #d4af37',
            animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      }>
        <HubPayInner />
      </Suspense>
    </ErrorBoundary>
  );
}
