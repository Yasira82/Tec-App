'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { piSession }        from '@/lib-client/pi/pi-session';
import { createU2APayment } from '@/lib-client/pi/pi-payment';
import { PiRuntime }        from '@/lib-client/pi/PiRuntime';
import { useTranslation, fill } from '@/lib/i18n';

const haptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    const patterns = { light: 10, medium: 25, heavy: 50 };
    navigator.vibrate(patterns[type]);
  }
};

const getSourceLabel = (source: string) => {
  switch (source) {
    case 'commerce':   return 'TEC Commerce';
    case 'ecommerce':  return 'TEC Ecommerce';
    case 'assets':     return 'TEC Assets';
    case 'analytics':  return 'TEC Analytics';
    case 'life':       return 'TEC Life';
    case 'connection': return 'TEC Connection';
    case 'zone':       return 'TEC Zone';
    case 'nexus':      return 'TEC Nexus';
    default:           return 'TEC Ecosystem';
  }
};

export interface ExternalPayment {
  amount:        number;
  memo:          string;
  productId:     string;
  returnUrl:     string;
  source:        string;
  internalId:    string;
  // Optional Nexus workflow-run link (C-109 §5): when a Nexus run payment is handed to
  // the Hub, these travel into the payment metadata so the run resumes on completion.
  nexusRunId?:   string;
  nexusStepIdx?: string;
}

export function PaymentModal({
  payment, onClose, onSuccess,
}: {
  payment:   ExternalPayment;
  onClose:   () => void;
  onSuccess: (txid: string, paymentId: string) => void;
}) {
  const { t } = useTranslation();
  const p     = t.hub.payment;
  const [isReady, setIsReady] = useState(false);
  const [status,  setStatus]  = useState<'idle' | 'paying' | 'success' | 'error' | 'cancelled'>('idle');
  const [message, setMessage] = useState('');
  const hasStarted = useRef(false);

  // ✅ انتظر Pi SDK يكون جاهز فعلاً قبل Pi.authenticate
  const waitForPiReady = (): Promise<void> => {
    if (PiRuntime.isReady()) {
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
    if (!PiRuntime.isAvailable()) { setStatus('error'); setMessage(p.openInPiBrowser); return; }

    const locked = await piSession.acquirePaymentLock();
    if (!locked) { setStatus('error'); setMessage(p.alreadyInProgress); return; }

    if (hasStarted.current) { piSession.releasePaymentLock(); return; }
    hasStarted.current = true;

    haptic('medium');
    try {
      const ready = await piSession.ensurePaymentsReady();
      if (!ready) {
        setStatus('error');
        setMessage(p.sdkNotReady);
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
        setMessage(result.message ?? p.failed);
        hasStarted.current = false;
      }
    } catch (err) {
      haptic('heavy');
      setStatus('error');
      setMessage(err instanceof Error ? err.message : p.failed);
      hasStarted.current = false;
    } finally {
      piSession.releasePaymentLock();
    }
  }, [payment, onSuccess, p]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        width: '100%', maxWidth: 360, borderRadius: 28,
        background: '#0B1020', border: '1px solid #FBBF2430',
        padding: 32, textAlign: 'center',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: 'linear-gradient(135deg,#FBBF24,#F59E0B)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, margin: '0 auto 20px', fontWeight: 900, color: '#0a0800',
        }}>T</div>

        <div style={{ fontSize: 11, color: '#4a4a5a', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
          {getSourceLabel(payment.source)}
        </div>
        <div style={{ fontSize: 48, fontWeight: 900, color: '#FBBF24', marginBottom: 4 }}>
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
                  border: '2px solid #FBBF2430', borderTop: '2px solid #FBBF24',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <span style={{ fontSize: 11, color: '#4a4a5a' }}>{p.authenticating}</span>
              </div>
            )}
            <button
              onClick={handlePay}
              disabled={!isReady}
              style={{
                padding: '18px 48px', borderRadius: 20,
                background: isReady ? 'linear-gradient(135deg,#FBBF24,#F59E0B)' : '#333',
                border: 'none',
                color: isReady ? '#0a0800' : '#666',
                fontSize: 18, fontWeight: 900,
                cursor: isReady ? 'pointer' : 'not-allowed',
                boxShadow: isReady ? '0 8px 32px rgba(251,191,36,0.3)' : 'none',
              }}
            >
              {isReady ? fill(p.pay, { amount: payment.amount }) : p.authenticating}
            </button>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#4a4a5a', fontSize: 12, cursor: 'pointer' }}
            >
              {p.cancel}
            </button>
          </div>
        )}

        {/* ── Paying ── */}
        {status === 'paying' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '3px solid #FBBF2430', borderTop: '3px solid #FBBF24',
              animation: 'spin 0.8s linear infinite',
            }} />
            <div style={{ fontSize: 14, color: '#6b6b7a' }}>{p.processing}</div>
          </div>
        )}

        {/* ── Success ── */}
        {status === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#7ee7c0' }}>{p.successTitle}</div>
            <div style={{ fontSize: 12, color: '#4a4a5a' }}>{p.redirecting}</div>
          </div>
        )}

        {/* ── Cancelled ── */}
        {status === 'cancelled' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 48 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f0c040' }}>{p.cancelledTitle}</div>
            <button
              onClick={onClose}
              style={{
                marginTop: 8, padding: '12px 24px', borderRadius: 14,
                background: '#ffffff10', border: '1px solid #ffffff20',
                color: '#fff', fontSize: 13, cursor: 'pointer',
              }}
            >
              {p.goBack}
            </button>
          </div>
        )}

        {/* ── Error ── */}
        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 48 }}>❌</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e74c3c' }}>{p.failedTitle}</div>
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
                  background: 'linear-gradient(135deg,#FBBF24,#F59E0B)',
                  border: 'none', color: '#0a0800',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {p.tryAgain}
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: '12px 24px', borderRadius: 14,
                  background: '#ffffff10', border: '1px solid #ffffff20',
                  color: '#fff', fontSize: 13, cursor: 'pointer',
                }}
              >
                {p.cancel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
                }
