'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams }                             from 'next/navigation';
import { usePiAuth }                                   from '@/lib-client/hooks/usePiAuth';
import { usePiSdkReady }                               from '@/lib-client/hooks/usePiSdkReady';
import { createU2APayment }                            from '@/lib-client/pi/pi-payment';
import { piSession }                                   from '@/lib-client/pi/pi-session';
import { ErrorBoundary }                               from '@/components/ErrorBoundary';

const goToReturn = (returnUrl: string) => {
  window.location.href = `/api/auth/sso?target=${encodeURIComponent(returnUrl)}`;
};

function HubPayInner() {
  const params    = useSearchParams();
  const { user, isAuthenticated, isLoading } = usePiAuth();
  const { piReady, authReady, ensurePiAuth } = usePiSdkReady();

  const amount    = parseFloat(params.get('amount')     ?? '0');
  const memo      = params.get('memo')       ?? 'TEC Payment';
  const returnUrl = params.get('return_url') ?? 'https://tec-commerce-app.vercel.app/app';
  const productId = params.get('product_id') ?? '';
  const source    = params.get('source')     ?? 'commerce';

  const [status,   setStatus]   = useState<'idle' | 'waiting' | 'paying' | 'success' | 'error' | 'cancelled'>('idle');
  const [message,  setMessage]  = useState('');
  const [sdkReady, setSdkReady] = useState(false);

  // ✅ انتظر Pi SDK ready event
  useEffect(() => {
    const onReady = () => setSdkReady(true);
    window.addEventListener('tec-pi-ready', onReady, { once: true });
    if (window.__TEC_PI_READY) setSdkReady(true);
    return () => window.removeEventListener('tec-pi-ready', onReady);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      window.location.href = `/?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }
  }, [isLoading, isAuthenticated]);

  const handlePay = useCallback(async () => {
    if (!window.__TEC_PI_READY || !window.Pi) {
      setStatus('error');
      setMessage('Pi SDK not ready — please try again');
      return;
    }
    if (!piReady)  { setStatus('error'); setMessage('Pi SDK not ready'); return; }
    if (!amount || amount <= 0) { setStatus('error'); setMessage('Invalid amount'); return; }

    const locked = await piSession.acquirePaymentLock();
    if (!locked) { setStatus('error'); setMessage('Payment already in progress'); return; }

    setStatus('paying');
    try {
      if (!authReady) await ensurePiAuth();

      const result = await createU2APayment(
        amount,
        memo,
        { source, product_id: productId, version: '1.0' },
        (type, msg, data) => {
          console.log(`[HubPay][${type}] ${msg}`, data ?? '');
        },
      );

      if (result.success && result.status === 'completed') {
        setStatus('success');
        setMessage('Payment successful! 🎉');
        setTimeout(() => {
          const returnWithParams = new URL(returnUrl);
          returnWithParams.searchParams.set('payment_status', 'success');
          returnWithParams.searchParams.set('txid',            result.txid      ?? '');
          returnWithParams.searchParams.set('payment_id',      result.paymentId ?? '');
          returnWithParams.searchParams.set('product_id',      productId);
          window.location.href = `/api/auth/sso?target=${encodeURIComponent(returnWithParams.toString())}`;
        }, 1500);
      } else if (result.status === 'cancelled') {
        setStatus('cancelled');
        setMessage('Payment cancelled');
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
  }, [piReady, authReady, ensurePiAuth, amount, memo, productId, returnUrl, source]);

  // ✅ Auto-start — انتظر 800ms بعد SDK جاهز عشان Pi Browser يخلص init
  useEffect(() => {
    if (!isLoading && isAuthenticated && piReady && sdkReady && status === 'idle') {
      setStatus('waiting');
      const timer = setTimeout(() => {
        setStatus('idle');
        handlePay();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, piReady, sdkReady, status, handlePay]);

  if (isLoading || !sdkReady) return (
    <div style={{ minHeight: '100vh', background: '#020205',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
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
          fontSize: 28, margin: '0 auto 20px', fontWeight: 900, color: '#0a0800' }}>
          T
        </div>

        <div style={{ fontSize: 11, color: '#4a4a5a', letterSpacing: 2,
          textTransform: 'uppercase', marginBottom: 8 }}>TEC Payment</div>

        <div style={{ fontSize: 48, fontWeight: 900, color: '#d4af37', marginBottom: 4 }}>
          {amount}π
        </div>
        <div style={{ fontSize: 12, color: '#4a4a5a', marginBottom: 32 }}>{memo}</div>

        {(status === 'idle' || status === 'waiting' || status === 'paying') && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%',
              border: '3px solid #d4af3730', borderTop: '3px solid #d4af37',
              animation: 'spin 0.8s linear infinite' }} />
            <div style={{ fontSize: 14, color: '#6b6b7a' }}>
              {status === 'waiting' ? 'Preparing...' : status === 'paying' ? 'Processing payment...' : 'Preparing payment...'}
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
                color: '#fff', fontSize: 13, cursor: 'pointer' }}>
              Go Back
            </button>
          </div>
        )}

        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 48 }}>❌</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e74c3c' }}>Payment Failed</div>
            <div style={{ fontSize: 12, color: '#4a4a5a', marginBottom: 8 }}>{message}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handlePay}
                style={{ padding: '12px 24px', borderRadius: 14,
                  background: 'linear-gradient(135deg,#d4af37,#b8882a)',
                  border: 'none', color: '#0a0800', fontSize: 13,
                  fontWeight: 700, cursor: 'pointer' }}>
                Try Again
              </button>
              <button onClick={() => goToReturn(returnUrl)}
                style={{ padding: '12px 24px', borderRadius: 14,
                  background: '#ffffff10', border: '1px solid #ffffff20',
                  color: '#fff', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
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
