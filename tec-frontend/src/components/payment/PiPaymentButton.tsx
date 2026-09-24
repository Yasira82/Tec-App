'use client';

import { useState, useEffect, useCallback } from 'react';
import { loginWithPi, isPiSilent, type LoginStage } from '@/lib-client/pi/pi-auth';
import { PiRuntime }  from '@/lib-client/pi/PiRuntime';

/**
 * How long Pi may stay silent before "Try again" appears.
 *
 * NOT the give-up point — `Pi.authenticate` keeps its full 45s, because a
 * first sign-in shows Pi's permission screen and a person reading it is not a
 * hang. This only offers the way out early, beside the wait: when Pi Browser's
 * app context belongs to another app, the bridge never replies (C-02, C-76),
 * a second tap queues behind the stuck call, and only a fresh page recovers.
 */
export const PI_SILENT_OFFER_MS = 15_000;

/**
 * "Try again" reloads the page. Whether a reload is ENOUGH is not established:
 * C-76 records that Pi Browser kept payment ownership across a reload, and what
 * a person on a phone saw recover the sign-in was closing Pi Browser entirely.
 * So the retry is remembered for a few minutes, and if Pi is silent again after
 * it, the screen says so and names the step that does work — instead of letting
 * the same button be pressed again for the same result.
 *
 * A flag, not a credential: sessionStorage holds only a timestamp (ADR-001 is
 * about tokens). Keeps the query, so a `returnTo` from `/api/auth/sso` survives.
 */
const RETRIED_KEY = 'tec_pi_signin_retried';
const RETRY_MEMORY_MS = 5 * 60_000;

const retry = () => {
  try { sessionStorage.setItem(RETRIED_KEY, String(Date.now())); } catch { /* ignore */ }
  window.location.reload();
};

const retriedRecently = (): boolean => {
  try {
    const at = Number(sessionStorage.getItem(RETRIED_KEY) ?? '');
    return Number.isFinite(at) && at > 0 && Date.now() - at < RETRY_MEMORY_MS;
  } catch { /* ignore */
    return false;
  }
};

export default function PiPaymentButton() {
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [stage,    setStage]    = useState<LoginStage | null>(null);
  const [offerRetry, setOfferRetry] = useState(false);
  // Pi was silent, a reload was tried, and Pi is silent again: stop offering the
  // button that just failed and name the step that recovered it on a phone.
  const [reloadDidNotHelp, setReloadDidNotHelp] = useState(false);

  // Offer "Try again" once Pi has been silent for PI_SILENT_OFFER_MS.
  useEffect(() => {
    if (!loading || stage !== 'pi') return;
    const t = setTimeout(() => {
      if (retriedRecently()) setReloadDidNotHelp(true);
      else setOfferRetry(true);
    }, PI_SILENT_OFFER_MS);
    return () => clearTimeout(t);
  }, [loading, stage]);

  useEffect(() => {
    if (window.__TEC_PI_READY) { setSdkReady(true); return; }

    const onReady = () => setSdkReady(true);
    window.addEventListener('tec-pi-ready', onReady);

    const poll = setInterval(() => {
      if (window.__TEC_PI_READY) {
        setSdkReady(true);
        clearInterval(poll);
      }
    }, 300);

    const timeout = setTimeout(() => {
      clearInterval(poll);
      if (PiRuntime.isAvailable()) {
        setSdkReady(true);
      }
    }, 30000);

    return () => {
      window.removeEventListener('tec-pi-ready', onReady);
      clearInterval(poll);
      clearTimeout(timeout);
    };
  }, []);

  const handleAuth = useCallback(async () => {
    if (!sdkReady) {
      if (window.__TEC_PI_READY) { setSdkReady(true); return; }
      if (PiRuntime.isAvailable()) { setSdkReady(true); return; }
      setError('Please open in Pi Browser');
      return;
    }

    setLoading(true);
    setError(null);
    setStage(null);
    setOfferRetry(false);

    try {
      const result = await loginWithPi({ onStage: setStage });
      if (!result?.success) {
        // The server answered without a session and without an error. This used
        // to fall through every branch and leave "Connecting..." on screen for
        // good — no message, no way out but closing the app.
        setError('Sign-in did not complete.');
        setOfferRetry(true);
        setLoading(false);
        return;
      }

      const params   = new URLSearchParams(window.location.search);
      const returnTo = params.get('returnTo');
      const redirect = params.get('redirect'); // ✅ للـ hub/pay

      // Where to land after the session is established.
      const dest = redirect
        ? redirect
        : returnTo
          ? `/api/auth/sso?target=${encodeURIComponent(returnTo)}`
          : '/hub';

      if (result.ssoToken) {
        // Finish login on a TOP-LEVEL navigation: sso-callback re-sets the session
        // cookies on a navigation response — the only cookie path Pi Browser
        // persists reliably (XHR Set-Cookie from pi-login was getting dropped,
        // which caused the /hub → login loop).
        const cb = new URL('/api/auth/sso-callback', window.location.origin);
        cb.searchParams.set('token',    result.ssoToken);
        cb.searchParams.set('redirect', dest);
        window.location.href = cb.toString();
      } else {
        window.location.href = dest;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';

      if (
        message.includes('not initialized') ||
        message.includes('failed to load') ||
        message.includes('init')
      ) {
        window.location.reload();
        return;
      }

      if (isPiSilent(err)) {
        setError(message);
        if (retriedRecently()) setReloadDidNotHelp(true);
        else setOfferRetry(true);
        setLoading(false);
        return;
      }

      if (message.includes('Pi Browser')) {
        setError('Please open in Pi Browser');
        setLoading(false);
        return;
      }

      setError(message);
      setLoading(false);
    }
  }, [sdkReady]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <button
        onClick={handleAuth}
        disabled={loading}
        style={{
          background:    'transparent',
          border:        'none',
          letterSpacing: '0.25em',
          color:         sdkReady ? 'var(--tec-gold)' : '#4a4a5a',
          fontSize:      '11px',
          fontWeight:    400,
          cursor:        loading ? 'not-allowed' : 'pointer',
          padding:       '4px 8px',
          opacity:       loading ? 0.6 : 1,
          textTransform: 'uppercase',
          fontFamily:    'inherit',
        }}>
        {loading
          ? stage === 'pi'     ? 'Waiting for Pi…'
          : stage === 'server' ? 'Signing in…'
          :                      'Connecting...'
          : sdkReady
            ? 'Sign in with Pi'
            : 'Loading...'}
      </button>
      {error && (
        <p style={{ fontSize: 11, color: '#e74c3c', textAlign: 'center' }}>{error}</p>
      )}
      {reloadDidNotHelp && (
        <p style={{ fontSize: 11, color: '#e8a33d', textAlign: 'center', margin: 0, maxWidth: 260 }}>
          Reloading did not help. Close Pi Browser completely, then open the Hub again.
        </p>
      )}
      {offerRetry && !reloadDidNotHelp && (
        <>
          {loading && (
            <p style={{ fontSize: 11, color: '#8a8a9a', textAlign: 'center', margin: 0 }}>
              Pi is taking longer than usual.
            </p>
          )}
          <button
            onClick={retry}
            style={{
              background: 'transparent', border: '1px solid var(--tec-gold)', borderRadius: 999,
              color: 'var(--tec-gold)', fontSize: 11, letterSpacing: '0.15em', padding: '6px 14px',
              cursor: 'pointer', textTransform: 'uppercase', fontFamily: 'inherit',
            }}>
            Try again
          </button>
        </>
      )}
    </div>
  );
}
