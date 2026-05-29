'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { piSession }        from '@/lib-client/pi/pi-session';
import { createU2APayment } from '@/lib-client/pi/pi-payment';

const haptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    const patterns = { light: 10, medium: 25, heavy: 50 };
    navigator.vibrate(patterns[type]);
  }
};

const getSourceLabel = (source: string) => {
  switch (source) {
    case 'commerce':  return 'TEC Commerce';
    case 'ecommerce': return 'TEC Ecommerce';
    case 'assets':    return 'TEC Assets';
    default:          return 'TEC Ecosystem';
  }
};

export interface ExternalPayment {
  amount:     number;
  memo:       string;
  productId:  string;
  returnUrl:  string;
  source:     string;
  internalId: string;
}

export function PaymentModal({
  payment, onClose, onSuccess,
}: {
  payment:   ExternalPayment;
  onClose:   () => void;
  onSuccess: (txid: string, paymentId: string) => void;
}) {
  const [isReady, setIsReady] = useState(false);
  const [status,  setStatus]  = useState<'idle' | 'paying' | 'success' | 'error' | 'cancelled'>('idle');
  const [message, setMessage] = useState('');
  const hasStarted = useRef(false);

  // ✅ انتظر Pi SDK يكون جاهز فعلاً قبل Pi.authenticate
  const waitForPiReady = (): Promise<void> => {
    if (
      typeof window !== 'undefined' &&
      (window as any).__TEC_PI_READY &&
      window.Pi
    ) {
      return Promise.resolve();
    }
    return new Promise<void>(resolve => {
      const handler = () => resolve();
      window.addEventListener('tec-pi-ready', handler, { once: true });
      setTimeout(handler, 12000);
    });
  };

  useEffect(() => {
    let cancelled = false;

    const tryAuth = async () => {
      // ✅ انتظر Pi.init() يخلص قبل ما نبدأ
      await waitForPiReady();
      if (cancelled) return;

await new Promise(r => setTimeout(r, 1000));
      if (cancelled) return;

      const ok = await piSession.ensurePaymentsReady();
      if (cancelled) return;
      if (ok) { setIsReady(true); return; }

      // ✅ reset + reInit + انتظار 2 ثانية قبل الـ retry
      piSession.reset();
      piSession.reInit(process.env.NEXT_PUBLIC_PI_SANDBOX === 'true');

      await new Promise(r => setTimeout(r, 2500));
      if (cancelled) return;

      const ok2 = await piSession.ensurePaymentsReady();
      if (cancelled) return;

      if (ok2) {
        setIsReady(true);
      } else {
        setStatus('error');
        setMessage(
          `Pi auth (${piSession.lastError}): ${piSession.lastRawError ?? '?'}`,
        );
      }
    };

    tryAuth();
    return () => { cancelled = true; };
  }, []);

  const handlePay = useCallback(async () => {
    if (!window.Pi) { setStatus('error'); setMessage('Open in Pi Browser'); return; }

    const locked = await piSession.acquirePaymentLock();
    if (!locked) { setStatus('error'); setMessage('Payment already in progress'); return; }

    if (hasStarted.current) { piSession.releasePaymentLock(); return; }
    hasStarted.current = true;

    haptic('medium');
    try {
      const ready = await piSession.ensurePaymentsReady();
      if (!ready) {
        setStatus('error');
        setMessage('Pi SDK not ready. Please try again.');
        hasStarted.current = false;
        return;
      }

      setStatus('paying');

      const result = await createU2APayment(
        payment.amount,
        payment.memo,
        { source: payment.source, product_id: payment.productId, version: '1.0' },
        payment.internalId,
      );

      if (result.success && result.status === 'completed') {
        setStatus('success');
        haptic('heavy');
        setTimeout(() => onSuccess(result.txid ?? '', result.paymentId ?? ''), 1500);
      } else if (result.status === 'cancelled') {
        setStatus('cancelled');
        hasStarted.current = false;
      } else {
        setStatus('error');
        setMessage(result.message ?? 'Payment failed');
        hasStarted.current = false;
      }
    } catch (err) {
      haptic('heavy');
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Payment failed');
      hasStarted.current = false;
    } finally {
      piSession.releasePaymentLock();
    }
  }, [payment, onSuccess]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        width: '100%', maxWidth: 360, borderRadius: 28,
        background: '#0d0d14', border: '1px solid #d4af3730',
        padding: 32, textAlign: 'center',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: 'linear-gradient(135deg,#d4af37,#b8882a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, margin: '0 auto 20px', fontWeight: 900, color: '#0a0800',
        }}>T</div>

        <div style={{ fontSize: 11, color: '#4a4a5a', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
          {getSourceLabel(payment.source)}
        </div>
        <div style={{ fontSize: 48, fontWeight: 900, color: '#d4af37', marginBottom: 4 }}>
          {payment.amount}π
        </div>
        <div style={{ fontSize: 12, color: '#4a4a5a', marginBottom: 32 }}>
          {payment.memo}
        </div>

        {/* ── Idle ── */}
        {status === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!isReady && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  border: '2px solid #d4af3730', borderTop: '2px solid #d4af37',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <span style={{ fontSize: 11, color: '#4a4a5a' }}>Authenticating...</span>
              </div>
            )}
            <button
              onClick={handlePay}
              disabled={!isReady}
              style={{
                padding: '18px 48px', borderRadius: 20,
                background: isReady ? 'linear-gradient(135deg,#d4af37,#b8882a)' : '#333',
                border: 'none',
                color: isReady ? '#0a0800' : '#666',
                fontSize: 18, fontWeight: 900,
                cursor: isReady ? 'pointer' : 'not-allowed',
                boxShadow: isReady ? '0 8px 32px rgba(212,175,55,0.3)' : 'none',
              }}
            >
              {isReady ? `Pay ${payment.amount}π` : 'Authenticating...'}
            </button>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#4a4a5a', fontSize: 12, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── Paying ── */}
        {status === 'paying' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '3px solid #d4af3730', borderTop: '3px solid #d4af37',
              animation: 'spin 0.8s linear infinite',
            }} />
            <div style={{ fontSize: 14, color: '#6b6b7a' }}>Processing payment...</div>
          </div>
        )}

        {/* ── Success ── */}
        {status === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#7ee7c0' }}>Payment Successful!</div>
            <div style={{ fontSize: 12, color: '#4a4a5a' }}>Redirecting back...</div>
          </div>
        )}

        {/* ── Cancelled ── */}
        {status === 'cancelled' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 48 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f0c040' }}>Cancelled</div>
            <button
              onClick={onClose}
              style={{
                marginTop: 8, padding: '12px 24px', borderRadius: 14,
                background: '#ffffff10', border: '1px solid #ffffff20',
                color: '#fff', fontSize: 13, cursor: 'pointer',
              }}
            >
              Go Back
            </button>
          </div>
        )}

        {/* ── Error ── */}
        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 48 }}>❌</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e74c3c' }}>Payment Failed</div>
            <div style={{ fontSize: 12, color: '#4a4a5a', marginBottom: 8 }}>{message}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {/* ✅ Try Again: reInit + delay قبل الـ retry */}
              <button
                onClick={() => {
                  setStatus('idle');
                  setMessage('');
                  hasStarted.current = false;
                  piSession.reset();
                  piSession.reInit(process.env.NEXT_PUBLIC_PI_SANDBOX === 'true');
                  setIsReady(false);
                  setTimeout(() => {
                    piSession.ensurePaymentsReady().then(ok => {
                      if (ok) setIsReady(true);
                    });
                  }, 2000);
                }}
                style={{
                  padding: '12px 24px', borderRadius: 14,
                  background: 'linear-gradient(135deg,#d4af37,#b8882a)',
                  border: 'none', color: '#0a0800',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Try Again
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: '12px 24px', borderRadius: 14,
                  background: '#ffffff10', border: '1px solid #ffffff20',
                  color: '#fff', fontSize: 13, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
                }
