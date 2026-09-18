'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { piSession }        from '@/lib-client/pi/pi-session';
import { createU2APayment } from '@/lib-client/pi/pi-payment';
import { PiRuntime }        from '@/lib-client/pi/PiRuntime';
import { useTranslation, fill } from '@/lib/i18n';
import { sourceLabel, isTestnetPaymentHost, shownParts, shownText } from '@/lib-client/payment/shown';

const haptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    const patterns = { light: 10, medium: 25, heavy: 50 };
    navigator.vibrate(patterns[type]);
  }
};

// The label this modal titles the payment with now comes from lib-client/payment/shown,
// because the SAME string has to reach the proof's `shown` field (IIC 4.5 §7). A second
// switch here would agree with it today and settle nothing on the day it stopped.
const getSourceLabel = sourceLabel;

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
const isTestnetModal = isTestnetPaymentHost;

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

  /**
   * The three things the buyer reads — as ONE object, used for the screen below and
   * for the `shown` field of a Nexus approval. IIC §7: a proof that records what was
   * approved but not what the person was looking at cannot settle the only dispute
   * that ever arises, and a `shown` composed separately from the render is the
   * platform's belief about its own screen rather than the screen.
   */
  const shown = useMemo(() => shownParts({
    label:   getSourceLabel(payment.source),
    amount:  payment.amount,
    memo:    payment.memo,
    testnet: isTestnetModal(),
  }), [payment.source, payment.amount, payment.memo]);

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

      setIsReady(true);

      // WARM THE SESSION while the user reads the modal.
      //
      // The first authenticate on a fresh page is slow — seconds, sometimes
      // tens of them. Doing it only after the tap spends that time while the
      // user is staring at a button they already pressed, which is what made
      // them press it again.
      //
      // This does NOT gate the button: Pay is live from this line. It is a
      // head start, not a precondition. If it finishes first the tap is
      // instant; if it does not, `handlePay` starts a fresh one inside the
      // gesture and never inherits a stalled warm-up.
      if (piSession.isAuthenticated) {
        pushTrace('info', 'SDK ready — session already authenticated');
        return;
      }
      pushTrace('info', 'SDK ready — warming the Pi session');
      piSession.ensurePaymentsReady().then(
        ok => { if (!cancelled) pushTrace(ok ? 'info' : 'info', `warm-up ${ok ? 'ready' : 'did not settle — the tap will retry'}`); },
        () => { if (!cancelled) pushTrace('info', 'warm-up did not settle — the tap will retry'); },
      );
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
      // Three outcomes, and only one of them costs the user any time:
      //
      //   already authenticated  → proceed now (login adopted, or warm-up won)
      //   warm-up still running  → JOIN it
      //   nothing yet            → start one
      //
      // Joining is not a preference, it is the rule. This used to reset() and
      // start a fresh call "so a stalled warm-up can never be inherited" —
      // written when a warm-up was suspected of being a dead call. It is not:
      // it is a healthy handshake that began at 0.0s. Resetting ABANDONS it
      // (Pi's bridge still holds it) and issues a SECOND one, which is the
      // concurrency Pi Browser answers neither of — the exact failure this
      // whole sequence has been chasing, caused by the code meant to avoid it.
      //
      // Read straight off a production trace:
      //
      //   0.0s SDK ready — warming the Pi session
      //   1.2s tap: warm-up still running — starting a fresh authenticate
      //   1.2s tap: authenticating            … and then nothing, for a minute
      //
      // A stalled warm-up cannot be inherited forever anyway: _doAuth carries
      // its own budget and settles, and the gate then lets the next attempt
      // run — sequentially, which is the only safe way to run two of these.
      if (piSession.isAuthenticated) {
        pushTrace('info', 'tap: session ready');
      } else {
        pushTrace('info', piSession.isAuthInFlight
          ? 'tap: joining the warm-up already in flight'
          : 'tap: authenticating');
      }
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

      // ── IIC 4.5 — record the approval, with what was on screen ────────────────
      //
      // Here, not after the payment: this is the instant the person agreed, and the
      // sentence they agreed to is `shown`, the object the three lines above were
      // rendered from.
      //
      // It does NOT block the payment when it fails. The intent layer's own rule is
      // that it may only ever NARROW what a human authorized (§6 property 3); refusing
      // to take a payment because an evidence row could not be written would be this
      // layer ADDING a restriction, and it would turn a recording problem into a
      // customer-facing one. The consequence of the failure is not hidden either —
      // identity-service will decline to emit a proof for a payment step with no
      // approval, so the gap shows up as a missing proof rather than as a signed
      // artefact with the evidence quietly absent.
      if (payment.nexusRunId) {
        try {
          const res = await fetch('/api/bff/intent/approval', {
            method:      'POST',
            headers:     { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              runId: payment.nexusRunId,
              step:  Number(payment.nexusStepIdx ?? 0),
              shown: shownText(shown),
            }),
          });
          if (!res.ok) pushTrace('error', `approval not recorded (${res.status}) — this run will have no proof`);
          else         pushTrace('info', 'approval recorded');
        } catch (err) {
          pushTrace('error', `approval not recorded (${(err as Error).message}) — this run will have no proof`);
        }
      }

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
    // `shown` is in here because it is the string this tap RECORDS. A stale closure
    // over it would post a sentence the screen is no longer showing — the one failure
    // an evidence field cannot survive, and the reason it is memoised above rather
    // than rebuilt each render.
  }, [payment, onSuccess, p, shown, pushTrace]);

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

        {/* The three things the buyer reads, rendered FROM the object that is
            recorded as `shown` (IIC §7). shown.ts was written to be the single
            composition and nothing outside its own test had ever called it — so
            the modal built the same strings a second time, which is precisely
            the drift it exists to prevent. Change what is read here and the
            proof changes with it, because there is one object. */}
        <div style={{ fontSize: 11, color: '#4a4a5a', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
          {shown.label}
          {shown.network && (
            <span style={{
              marginLeft: 8, padding: '2px 6px', borderRadius: 6,
              background: '#f59e0b22', border: '1px solid #f59e0b55',
              color: '#f59e0b', fontSize: 9, letterSpacing: 1,
            }}>{shown.network}</span>
          )}
        </div>
        <div style={{ fontSize: 48, fontWeight: 900, color: 'var(--tec-gold)', marginBottom: 4 }}>
          {shown.amount}
        </div>
        <div style={{ fontSize: 12, color: '#4a4a5a', marginBottom: 32 }}>
          {shown.memo}
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
