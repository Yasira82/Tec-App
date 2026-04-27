/**
 * PiSessionManager v4 Final — Pi Runtime Isolation Layer
 * Production-locked: self-healing lock + visibility resume + exposed errors + payment guard
 */

const RESOLVE_TIMEOUT_MS   = 12000;
const FAILURE_COOLDOWN_MS  = 3000;
const MAX_SESSION_AGE_MS   = 5 * 60 * 1000;  // 5 min
const PAYMENT_LOCK_TIMEOUT = 20000;           // 20s self-healing

declare global {
  interface Window {
    __TEC_PI_AUTHENTICATED?: boolean;
  }
}
export type PiAuthError =
  | 'SDK_MISSING'
  | 'TIMEOUT'
  | 'USER_CANCELLED'
  | 'SCOPE_INVALID'
  | 'OFFLINE'
  | 'NOT_VISIBLE'
  | 'COOLDOWN'
  | 'PAYMENT_IN_FLIGHT'
  | 'UNKNOWN';

interface PiAuthResult {
  ok:     boolean;
  error?: PiAuthError;
}

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), ms)
    ),
  ]);

const retryFetch = async (
  fn:      () => Promise<Response>,
  attempts = 3,
): Promise<Response> => {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (_e) {
      if (i === attempts - 1) throw _e;
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw new Error('All retry attempts failed');
};

class PiSessionManager {
  private authPromise:      Promise<PiAuthResult> | null = null;
  private authenticated:    boolean        = false;
  private hasPaymentsScope: boolean        = false;
  private authVersion:      number         = 0;
  private lastFailureAt:    number         = 0;
  private lastAuthAt:       number         = 0;
  private paymentInFlight:  boolean        = false;
  private paymentLockAt:    number         = 0;
  private _lastError:       PiAuthError | null = null;

  // ✅ ensureAuth — fully hardened
  async ensureAuth(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    if (!navigator.onLine) {
      this._lastError = 'OFFLINE';
      this._log('warn', 'auth:skip', 'offline');
      return false;
    }

    if (document.visibilityState !== 'visible') {
      this._lastError = 'NOT_VISIBLE';
      this._log('warn', 'auth:skip', 'not_visible');
      return false;
    }

    if (Date.now() - this.lastFailureAt < FAILURE_COOLDOWN_MS) {
      this._lastError = 'COOLDOWN';
      this._log('warn', 'auth:skip', 'cooldown');
      return false;
    }

    // ✅ Drift detection
    if (this.authenticated && (!window.__TEC_PI_READY || !window.Pi)) {
      this._log('warn', 'auth:drift', 'SDK lost — resetting');
      this.reset();
    }

    // ✅ Scope awareness
    if (this.authenticated && !this.hasPaymentsScope) {
      this._log('warn', 'auth:scope', 'payments scope missing — resetting');
      this.reset();
    }

    // ✅ Session expiry
    if (this.authenticated && Date.now() - this.lastAuthAt > MAX_SESSION_AGE_MS) {
      this._log('info', 'auth:revalidate', 'session expired — resetting');
      this.reset();
    }

    if (this.authenticated) return true;
    if (this.authPromise)   return this.authPromise.then(r => r.ok);

    this.authPromise = this._doAuth();
    return this.authPromise.then(r => r.ok);
  }

  // ✅ P1 Self-healing payment lock
  async acquirePaymentLock(): Promise<boolean> {
    if (this.paymentInFlight) {
      if (Date.now() - this.paymentLockAt > PAYMENT_LOCK_TIMEOUT) {
        this._log('warn', 'payment:lock', 'stale lock — force releasing');
        this.paymentInFlight = false;
      } else {
        this._log('warn', 'payment:lock', 'already in flight');
        return false;
      }
    }
    this.paymentInFlight = true;
    this.paymentLockAt   = Date.now();
    this._log('info', 'payment:lock', 'acquired');
    return true;
  }

  releasePaymentLock(): void {
    this.paymentInFlight = false;
    this.paymentLockAt   = 0;
    this._log('info', 'payment:lock', 'released');
  }

  private async _doAuth(): Promise<PiAuthResult> {
    const currentVersion = ++this.authVersion;
    this._log('info', 'auth:start', `version=${currentVersion}`);

    try {
      const Pi = window.Pi;
      if (!Pi) return this._fail('SDK_MISSING');

      const result = Pi.authenticate(
        ['username', 'payments'],
        async (payment: unknown) => {
          const p = payment as { identifier?: string } | null;
          if (!p?.identifier) return;
          try {
            await retryFetch(() => fetch('/api/payment/resolve-incomplete', {
              method:      'POST',
              credentials: 'include',
              headers:     { 'Content-Type': 'application/json' },
              body:        JSON.stringify({ pi_payment_id: p.identifier }),
            }));
            this._log('info', 'payment:resolved', p.identifier);
          } catch { /* ignore */ }
        },
      );

      if (result && typeof (result as Promise<unknown>).then === 'function') {
        await withTimeout(result as Promise<unknown>, RESOLVE_TIMEOUT_MS);
      }

      if (currentVersion !== this.authVersion) {
        this._log('warn', 'auth:stale', `${currentVersion} !== ${this.authVersion}`);
        return { ok: false, error: 'UNKNOWN' };
      }

      this.authenticated    = true;
      this.hasPaymentsScope = true;
      this.lastAuthAt       = Date.now();
      this._lastError       = null;
      window.__TEC_PI_AUTHENTICATED = true;

      this._log('info', 'auth:success', `version=${currentVersion}`);
      window.dispatchEvent(new CustomEvent('tec:pi:auth:success', {
        detail: { version: currentVersion, ts: Date.now() },
      }));

      return { ok: true };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      let error: PiAuthError = 'UNKNOWN';
      if (msg === 'TIMEOUT')                             error = 'TIMEOUT';
      else if (/cancel|denied|rejected|user.reject/i.test(msg)) error = 'USER_CANCELLED';
      else if (/scope|permission/i.test(msg))            error = 'SCOPE_INVALID';
      else if (!window.Pi)                               error = 'SDK_MISSING';

      return this._fail(error);
    } finally {
      this.authPromise = null;
    }
  }

  private _fail(error: PiAuthError): PiAuthResult {
    this.authenticated             = false;
    this.hasPaymentsScope          = false;
    this.lastFailureAt             = Date.now();
    this._lastError                = error;
    window.__TEC_PI_AUTHENTICATED  = false;

    this._log('warn', 'auth:failed', error);
    window.dispatchEvent(new CustomEvent('tec:pi:auth:failed', {
      detail: { error, ts: Date.now() },
    }));

    return { ok: false, error };
  }

  reset(): void {
    this.authenticated             = false;
    this.hasPaymentsScope          = false;
    this.authPromise               = null;
    this.lastFailureAt             = 0;
    this.lastAuthAt                = 0;
    this.paymentInFlight           = false;
    this.paymentLockAt             = 0;
    this._lastError                = null;
    window.__TEC_PI_AUTHENTICATED  = false;
    this._log('info', 'auth:reset', 'session cleared');
  }

  private _log(level: 'info' | 'warn' | 'error', event: string, detail?: string): void {
    const payload = { event, detail, ts: Date.now(), version: this.authVersion };
    if (level === 'info')  console.info('[PiSession]',  payload);
    if (level === 'warn')  console.warn('[PiSession]',  payload);
    if (level === 'error') console.error('[PiSession]', payload);
  }

  get isAuthenticated():  boolean          { return this.authenticated; }
  get hasScope():         boolean          { return this.hasPaymentsScope; }
  get isPaymentLocked():  boolean          { return this.paymentInFlight; }
  get lastError():        PiAuthError | null { return this._lastError; }
}

export const piSession = new PiSessionManager();
