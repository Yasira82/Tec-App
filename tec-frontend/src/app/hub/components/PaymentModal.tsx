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

/**
 * Where the Pi SDK's own account of the payment goes when the only console
 * available is a phone. Testnet host or `?debug=1` — never on Mainnet, where a
 * buyer would see raw internals mid-payment.
 */
/**
 * Which NETWORK this modal is about to pay on — shown as a chip, and only when
 * it is the Testnet.
 *
 * A Mode-1 hop that started on a Testnet app can end up on the MAINNET Hub, and
 * when it does nothing says so. The modal looks identical, the payment is
 * created with no `testnet` marker, and it is approved with the Mainnet key —
 * which a Test-Pi wallet can never pay. What the tester sees is
 * "Pi auth (TIMEOUT)" and an unchanged screen.
 *
 * That is exactly what happened: the Vercel log shows `/hub` and
 * `POST /api/payment/create` served by `hub.tecosystem.app` while the tester
 * believed they were on `tec-app-frontend.vercel.app`, and payment-service
 * recorded `source.testnet: false`. It also explains why the diagnostic trace
 * never appeared — `traceVisible()` deliberately hides it off the Testnet host.
 *
 * Nothing new is shown to a real buyer: on Mainnet this renders nothing at all.
 * The chip only ever means "this is NOT real Pi".
 */
const isTestnetModal = (): boolean =>
  typeof window !== 'undefined' && /\.vercel\.app$/i.test(window.location.hostname);

const traceVisible = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (/\.vercel\.app$/i.test(window.location.hostname)) return true;
  try { return new URLSearchParams(window.location.search).get('debug') === '1'; }
  catch { return false; }
};

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
  // Every line the SDK reports, in order, with the seconds it arrived at — so a
  // hang shows WHERE it stopped, not just that it stopped.
  const [trace, setTrace] = useState<string[]>([]);
  const traceStart = useRef<number>(0);
  const pushTrace = useCallback((level: string, msg: string) => {
    const t = traceStart.current || (traceStart.current = Date.now());
    setTrace((prev) => [...prev, `${((Date.now() - t) / 1000).toFixed(1)}s ${level}: ${msg}`]);
  }, []);
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

    // The auth phase had NO trace — it printed one line, `Pi auth (TIMEOUT):
    // TIMEOUT`, which cannot tell apart four different failures:
    //
    //   · waitForPiReady never resolved (its own 12s fallback fired)
    //   · attempt 1's Pi.authenticate hung (the 25s budget in pi-session)
    //   · attempt 1 failed for some other reason and the RETRY hung
    //   · a second Pi.authenticate ran concurrently with one already in
    //     flight — Pi Browser breaks on that, and this component's
    //     reset()+retry is a way to cause it
    //
    // Measured against it: `/pi-test` calls `window.Pi.authenticate` DIRECTLY
    // and answers in 0.6s on this same host, with no unfinished payment. So
    // the SDK is healthy and the fault is somewhere in these ~30 lines. One
    // line of output cannot say where, and guessing from it has already cost
    // three wrong diagnoses.
    // WAIT FOR THE SDK. DO NOT AUTHENTICATE HERE.
    //
    // This modal used to run a full auth ladder on mount — wait for init, 1s,
    // ensurePaymentsReady, and on failure reset + reInit + 2.5s + retry — and
    // it ended in `Pi auth (TIMEOUT): TIMEOUT` every time on the Testnet host.
    //
    // What finally separated the cases was not a log, it was a comparison:
    //
    //   /pi-test                 authenticates ON A TAP      → answers in 0.6s
    //   every other TEC app      authenticates ON A TAP      → works in prod
    //   this modal               authenticated ON MOUNT      → never answered
    //
    // The Hub was the only place in the fleet calling `Pi.authenticate` with no
    // user gesture behind it. Pi Browser is a WebView, and a WebView will not
    // raise an auth dialog for a call the user did not initiate — it does not
    // reject, it simply never answers, which is exactly the shape of this
    // failure: no error, no log, a spinner, then our own timer.
    //
    // So do what the working paths do. The button is live immediately and
    // `handlePay` authenticates inside the tap — `createU2APayment` →
    // `ensurePaymentsReady()` already does it there, so nothing else moves.
    //
    // This also removes the second authenticate the retry could start. The gate
    // in pi-session stays: it is what keeps login and payment from overlapping
    // at all, and the two problems are independent.
    const waitForSdk = async () => {
      pushTrace('info', `build ${process.env.NEXT_PUBLIC_BUILD_SHA ?? '?'}`);
      pushTrace('info', 'waiting for Pi.init');
      await waitForPiReady();
      if (cancelled) return;

      if (!PiRuntime.isAvailable()) {
        pushTrace('error', 'Pi SDK not available — open in Pi Browser');
        setStatus('error');
        setMessage(p.openInPiBrowser);
        return;
      }

      pushTrace('info', 'SDK ready — auth happens on tap');
      setIsReady(true);
    };

    waitForSdk();
    return () => { cancelled = true; };
  }, []);

  const handlePay = useCallback(async () => {
    if (!PiRuntime.isAvailable()) { setStatus('error'); setMessage(p.openInPiBrowser); return; }

    // A SECOND TAP IS NOT A FAILED PAYMENT.
    //
    // The lock being held means a payment from this page is ALREADY RUNNING —
    // usually Pi's own dialog is opening and the user, seeing nothing yet,
    // tapped again. Turning that into a terminal "Payment Failed" screen tells
    // the user their payment died while it is still in flight, and it replaces
    // the live modal with an error the first attempt can no longer clear.
    //
    // Observed exactly that way: a real Test-Pi payment completed in Pi's
    // wallet while this screen read "Payment Failed — Payment already in
    // progress". The lie is the bug; the lock was doing its job.
    //
    // So a second tap is a no-op. The trace still records it, because "the
    // user tapped twice" is worth knowing when reading one of these later.
    const locked = await piSession.acquirePaymentLock();
    if (!locked) {
      pushTrace('info', 'tap ignored — a payment is already running');
      return;
    }

    if (hasStarted.current) { piSession.releasePaymentLock(); return; }
    hasStarted.current = true;

    haptic('medium');
    try {
      // The authenticate now lives HERE, inside the tap — see the note in the
      // mount effect. A WebView will not raise Pi's auth dialog for a call the
      // user did not initiate, and it never says so.
      pushTrace('info', 'tap: authenticating');
      const ready = await piSession.ensurePaymentsReady();
      if (!ready) {
        pushTrace('error',
          `tap: auth FAILED ${piSession.lastError} / ${piSession.lastRawError ?? '?'}`);
        setStatus('error');
        setMessage(`Pi auth (${piSession.lastError}): ${piSession.lastRawError ?? '?'}`);
        hasStarted.current = false;
        return;
      }
      pushTrace('info', 'tap: authenticated');

      setStatus('paying');

      const result = await createU2APayment(
        payment.amount,
        payment.memo,
        { source: payment.source, product_id: payment.productId, version: '1.0' },
        payment.internalId,
        // The diagnostic channel has existed in pi-payment.ts all along and NO
        // caller passed it — which is why three rounds of this failure were
        // diagnosed from server logs that, by definition, cannot see the step
        // that fails. `createPayment` is called and nothing comes back: no
        // error, no callback, and payment-service logs "created" with no
        // "approving" after it. The missing information was never on the
        // server.
        //
        // Shown on screen only where a phone is the only console available.
        pushTrace,
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
        background: 'var(--tec-surface-1)', border: '1px solid var(--tec-gold)30',
        padding: 32, textAlign: 'center',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: 'var(--tec-gold)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, margin: '0 auto 20px', fontWeight: 900, color: 'var(--tec-on-gold)',
        }}>T</div>

        <div style={{ fontSize: 11, color: '#4a4a5a', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
          {getSourceLabel(payment.source)}
          {isTestnetModal() && (
            <span style={{
              marginLeft: 8, padding: '2px 6px', borderRadius: 6,
              background: '#f59e0b22', border: '1px solid #f59e0b55',
              color: '#f59e0b', fontSize: 9, letterSpacing: 1,
            }}>TESTNET</span>
          )}
        </div>
        <div style={{ fontSize: 48, fontWeight: 900, color: 'var(--tec-gold)', marginBottom: 4 }}>
          {payment.amount}π
        </div>
        <div style={{ fontSize: 12, color: '#4a4a5a', marginBottom: 32 }}>
          {payment.memo}
        </div>

        {/* The SDK's own account of what happened, on the one surface a phone
            can read. A hang shows WHERE it stopped: if the last line is
            "Backend record created" then createPayment was called and answered
            with nothing, and the fault is between the browser and Pi — not in
            anything the server can see. */}
        {traceVisible() && trace.length > 0 && (
          <div style={{
            textAlign: 'left', marginBottom: 20, padding: 10, borderRadius: 10,
            background: '#00000040', border: '1px solid #ffffff14',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 10, lineHeight: 1.7, color: '#7a7a8a',
            maxHeight: 160, overflowY: 'auto', wordBreak: 'break-word',
          }}>
            {trace.map((line, i) => (
              <div key={i} style={{ color: line.includes('error') ? '#ef4444' : undefined }}>{line}</div>
            ))}
          </div>
        )}

        {/* ── Idle ── */}
        {status === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!isReady && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  border: '2px solid var(--tec-gold)30', borderTop: '2px solid var(--tec-gold)',
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
                background: isReady ? 'var(--tec-gold)' : '#333',
                border: 'none',
                color: isReady ? 'var(--tec-on-gold)' : 'var(--tec-text-3)',
                fontSize: 18, fontWeight: 900,
                cursor: isReady ? 'pointer' : 'not-allowed',
                boxShadow: isReady ? '0 8px 32px rgba(var(--tec-gold-rgb),0.3)' : 'none',
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
              border: '3px solid var(--tec-gold)30', borderTop: '3px solid var(--tec-gold)',
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
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--tec-gold)' }}>{p.cancelledTitle}</div>
            <button
              onClick={onClose}
              style={{
                marginTop: 8, padding: '12px 24px', borderRadius: 14,
                background: 'var(--tec-fill-soft)', border: '1px solid var(--tec-border)',
                color: 'var(--tec-text-1)', fontSize: 13, cursor: 'pointer',
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
              {/* Try Again just returns to idle. It used to reset + reInit and
                  then authenticate on a 2s timer — two seconds after the tap,
                  so the user gesture was long gone and a WebView will not raise
                  Pi's dialog for that. The retry is the next Pay tap. */}
              <button
                onClick={() => {
                  setStatus('idle');
                  setMessage('');
                  hasStarted.current = false;
                  piSession.reset();
                  setIsReady(true);
                }}
                style={{
                  padding: '12px 24px', borderRadius: 14,
                  background: 'var(--tec-gold)',
                  border: 'none', color: 'var(--tec-on-gold)',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {p.tryAgain}
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: '12px 24px', borderRadius: 14,
                  background: 'var(--tec-fill-soft)', border: '1px solid var(--tec-border)',
                  color: 'var(--tec-text-1)', fontSize: 13, cursor: 'pointer',
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
