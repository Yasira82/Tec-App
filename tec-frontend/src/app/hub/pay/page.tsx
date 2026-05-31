'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams }                                      from 'next/navigation';
import { usePiAuth }                                            from '@/lib-client/hooks/usePiAuth';
import { createU2APayment }                                     from '@/lib-client/pi/pi-payment';
import { piSession }                                            from '@/lib-client/pi/pi-session';
import { ErrorBoundary }                                        from '@/components/ErrorBoundary';

const HUB_ORIGIN = 'https://hub.tecosystem.app';
const goToReturn = (url: string) => { window.location.href = url; };
const getCsrf    = (): string =>
  document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';

function HubPayInner() {
  const params = useSearchParams();
  const { isAuthenticated, isLoading } = usePiAuth();

  const amount    = parseFloat(params.get('amount')     ?? '0');
  const memo      = params.get('memo')       ?? 'TEC Payment';
  const returnUrl = params.get('return_url') ?? 'https://commerce.tecosystem.app/app';
  const productId = params.get('product_id') ?? '';
  const source    = params.get('source')     ?? 'commerce';

  const [status,   setStatus]   = useState<'idle' | 'auth' | 'paying' | 'success' | 'error' | 'cancelled'>('idle');
  const [message,  setMessage]  = useState('');
  const [sdkReady, setSdkReady] = useState(false);
  const hasStarted = useRef(false);

  // ✅ SDK ready listener
  useEffect(() => {
    if (window.__TEC_PI_READY) { setSdkReady(true); return; }

    const onReady = () => setSdkReady(true);
    window.addEventListener('tec-pi-ready', onReady, { once: true });

    const fallback = setTimeout(() => {
      if (!window.__TEC_PI_READY) {
        sessionStorage.setItem('post_pi_redirect',
          window.location.pathname + window.location.search);
        window.location.href = `${HUB_ORIGIN}/hub`;
      }
    }, 5000);

    return () => {
      window.removeEventListener('tec-pi-ready', onReady);
      clearTimeout(fallback);
    };
  }, []);

  // ✅ Auth guard
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      window.location.href = `${HUB_ORIGIN}/?redirect=${encodeURIComponent(window.location.href)}`;
    }
  }, [isLoading, isAuthenticated]);

  const handlePay = useCallback(async () => {
    if (!window.Pi)             { setStatus('error'); setMessage('Open in Pi Browser'); return; }
    if (!amount || amount <= 0) { setStatus('error'); setMessage('Invalid amount');     return; }

    if (hasStarted.current) return;
    hasStarted.current = true;

    const locked = await piSession.acquirePaymentLock();
    if (!locked) { setStatus('error'); setMessage('Payment already in progress'); return; }

    try {
      setStatus('paying');
      const result = await createU2APayment(
        amount, memo,
        { source, product_id: productId, version: '1.0' },
      );

      if (result.success && result.status === 'completed') {
        setStatus('success');
        setTimeout(() => {
          const ret = new URL(returnUrl);
          ret.searchParams.set('payment_status', 'success');
          ret.searchParams.set('txid',           result.txid      ?? '');
          ret.searchParams.set('payment_id',     result.paymentId ?? '');
          ret.searchParams.set('product_id',     productId);
          goToReturn(ret.toString());
        }, 1500);
      } else if (result.status === 'cancelled') {
        setStatus('cancelled');
        hasStarted.current = false;
      } else {
        setStatus('error');
        setMessage(result.message ?? 'Payment failed');
        hasStarted.current = false;
      }
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Payment failed');
      hasStarted.current = false;
    } finally {
      piSession.releasePaymentLock();
    }
  }, [amount, memo, productId, returnUrl, source]);

  /* ── Loading ──────────────────────────────────────── */
  if (isLoading || !isAuthenticated || !sdkReady) return (
    <div style={{ minHeight: '100vh', background: '#020205', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg,#d4af37,#b8882a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: '#0a0800' }}>T</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #d4af3730', borderTop: '2px solid #d4af37', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: 13, color: '#4a4a5a' }}>Preparing payment...</span>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!amount || amount <= 0) return (
    <div style={{ minHeight: '100vh', background: '#020205', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#e74c3c' }}>Invalid payment parameters</div>
    </div>
  );

  /* ── Payment UI ───────────────────────────────────── */
  return (
    <div style={{ minHeight: '100vh', background: '#020205', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: '100%', maxWidth: 360, borderRadius: 28, background: '#0d0d14', border: '1px solid #d4af3730', padding: 32, textAlign: 'center', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg,#d4af37,#b8882a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 20px', fontWeight: 900, color: '#0a0800' }}>T</div>
        <div style={{ fontSize: 11, color: '#4a4a5a', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
          {source === 'commerce' ? 'TEC Commerce' : source === 'assets' ? 'TEC Assets' : 'TEC Ecosystem'}
        </div>
        <div style={{ fontSize: 48, fontWeight: 900, color: '#d4af37', marginBottom: 4 }}>{amount}π</div>
        <div style={{ fontSize: 12, color: '#4a4a5a', marginBottom: 32 }}>{memo}</div>

        {status === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button onClick={handlePay} style={{ padding: '18px 48px', borderRadius: 20, background: 'linear-gradient(135deg,#d4af37,#b8882a)', border: 'none', color: '#0a0800', fontSize: 18, fontWeight: 900, cursor: 'pointer', boxShadow: '0 8px 32px rgba(212,175,55,0.3)' }}>
              Pay {amount}π
            </button>
            <button onClick={() => goToReturn(returnUrl)} style={{ background: 'none', border: 'none', color: '#4a4a5a', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          </div>
        )}

        {(status === 'auth' || status === 'paying') && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #d4af3730', borderTop: '3px solid #d4af37', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ fontSize: 14, color: '#6b6b7a' }}>{status === 'auth' ? 'Authenticating...' : 'Processing payment...'}</div>
          </div>
        )}

        {status === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#7ee7c0' }}>Payment Successful!</div>
            <div style={{ fontSize: 12, color: '#4a4a5a' }}>Redirecting...</div>
          </div>
        )}

        {status === 'cancelled' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 48 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f0c040' }}>Cancelled</div>
            <button onClick={() => goToReturn(returnUrl)} style={{ marginTop: 8, padding: '12px 24px', borderRadius: 14, background: '#ffffff10', border: '1px solid #ffffff20', color: '#fff', fontSize: 13, cursor: 'pointer' }}>Go Back</button>
          </div>
        )}

        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 48 }}>❌</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e74c3c' }}>Payment Failed</div>
            <div style={{ fontSize: 12, color: '#4a4a5a', marginBottom: 8 }}>{message}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setStatus('idle'); hasStarted.current = false; }} style={{ padding: '12px 24px', borderRadius: 14, background: 'linear-gradient(135deg,#d4af37,#b8882a)', border: 'none', color: '#0a0800', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Try Again</button>
              <button onClick={() => goToReturn(returnUrl)} style={{ padding: '12px 24px', borderRadius: 14, background: '#ffffff10', border: '1px solid #ffffff20', color: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HubPayPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={
        <div style={{ minHeight: '100vh', background: '#020205', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #d4af3730', borderTop: '3px solid #d4af37', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      }>
        <HubPayInner />
      </Suspense>
    </ErrorBoundary>
  );
}
