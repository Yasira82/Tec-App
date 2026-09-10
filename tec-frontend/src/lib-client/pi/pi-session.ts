import { resolvePiAppId } from '@/lib-client/pi/pi-app-id';
/**
 * PiSessionManager v4 Final — Pi Runtime Isolation Layer
 */

const RESOLVE_TIMEOUT_MS   = 25000;
const MAX_SESSION_AGE_MS   = 5 * 60 * 1000;
const PAYMENT_LOCK_TIMEOUT = 20000;

declare global {
  interface Window { __TEC_PI_AUTHENTICATED?: boolean; }
}

export type PiAuthError =
  | 'SDK_MISSING' | 'TIMEOUT' | 'USER_CANCELLED'
  | 'SCOPE_INVALID' | 'OFFLINE' | 'UNKNOWN';

interface PiAuthResult { ok: boolean; error?: PiAuthError; }

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([promise, new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error('TIMEOUT')), ms))]);

const retryFetch = async (fn: () => Promise<Response>, attempts = 3): Promise<Response> => {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (_e) {
      if (i === attempts - 1) throw _e;
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw new Error('All retry attempts failed');
};

class PiSessionManager {
  private authPromise:          Promise<PiAuthResult> | null = null;
  private paymentsReadyPromise: Promise<boolean> | null      = null;
  private authenticated:        boolean            = false;
  private hasPaymentsScope:     boolean            = false;
  private authVersion:          number             = 0;
  private lastAuthAt:           number             = 0;
  private paymentInFlight:      boolean            = false;
  private paymentLockAt:        number             = 0;
  private _lastError:           PiAuthError | null = null;
  private _lastRawError:        string | null      = null;

  async ensurePaymentsReady(): Promise<boolean> {
    if (this.paymentsReadyPromise) return this.paymentsReadyPromise;
    this.paymentsReadyPromise = (async () => {
      await this._waitForInit();
      return this.ensureAuth();
    })();
    const ok = await this.paymentsReadyPromise;
    if (!ok) this.paymentsReadyPromise = null;
    return ok;
  }

  // ✅ 30s بدل 15s + يسمع tec-pi-error عشان يفشل بسرعة
  private _waitForInit(timeout = 30000): Promise<void> {
    if (typeof window !== 'undefined' && window.__TEC_PI_READY && window.Pi) {
      return Promise.resolve();
    }
    if (typeof window !== 'undefined' && (window as any).__TEC_PI_ERROR) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      const done = () => {
        window.removeEventListener('tec-pi-ready', done);
        window.removeEventListener('tec-pi-error', done);
        resolve();
      };
      window.addEventListener('tec-pi-ready', done, { once: true });
      window.addEventListener('tec-pi-error', done, { once: true });
      setTimeout(done, timeout);
    });
  }

  reInit(sandbox: boolean, appId?: string): void {
    if (typeof window === 'undefined' || !window.Pi) return;
    try { window.Pi.init({ version: '2.0', sandbox, ...(appId ? { appId } : {}) }); }
    catch { /* "already initialized" — fine */ }
  }

  async ensureAuth(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (!navigator.onLine) { this._lastError = 'OFFLINE'; return false; }

    if (this.authenticated && (!window.__TEC_PI_READY || !window.Pi)) {
      this._log('warn', 'auth:drift', 'SDK lost — resetting'); this.reset();
    }
    if (this.authenticated && !this.hasPaymentsScope) {
      this._log('warn', 'auth:scope', 'payments scope missing — resetting'); this.reset();
    }
    if (this.authenticated && Date.now() - this.lastAuthAt > MAX_SESSION_AGE_MS) {
      this._log('info', 'auth:revalidate', 'session expired — resetting'); this.reset();
    }

    if (this.authenticated) return true;
    if (this.authPromise)   return this.authPromise.then(r => r.ok);

    this.authPromise = this._doAuth();
    return this.authPromise.then(r => r.ok);
  }

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

      // ✅ PiSdkLoader فشل → فشل بسرعة
      if ((window as any).__TEC_PI_ERROR) {
        this._lastRawError = 'PiSdkLoader timeout';
        return this._fail('SDK_MISSING');
      }

      // ✅ Pi مش ready لسه → جرّب Pi.init() مباشرةً (fallback)
      if (!window.__TEC_PI_READY) {
        // Mainnet unless explicitly opted in — same polarity as PiSdkLoader and
        // PaymentModal (`=== 'true'`). The old `!== 'false'` initialized in
        // SANDBOX whenever the env var was unset → authenticate then failed.
        const sandbox = process.env.NEXT_PUBLIC_PI_SANDBOX === 'true';
        const appId   = resolvePiAppId();
        try {
          Pi.init({ version: '2.0', sandbox, ...(appId ? { appId } : {}) });
          window.__TEC_PI_READY = true;
          window.dispatchEvent(new Event('tec-pi-ready'));
          this._log('info', 'auth:init', 'Pi.init() called from _doAuth');
        } catch (initErr) {
          const initMsg = initErr instanceof Error ? initErr.message : String(initErr);
          this._log('warn', 'auth:init-catch', initMsg);
          if (initMsg.toLowerCase().includes('already')) {
            window.__TEC_PI_READY = true; // already initialized — fine
          } else {
            this._lastRawError = `Pi.init failed: ${initMsg}`;
            return this._fail('SDK_MISSING');
          }
        }
        await new Promise(r => setTimeout(r, 300));
      }

      const result = Pi.authenticate(
        ['username', 'payments'],
        async (payment: unknown) => {
          const p = payment as { identifier?: string } | null;
          if (!p?.identifier) return;
          try {
            await retryFetch(() => fetch('/api/payment/resolve-incomplete', {
              method: 'POST', credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': (typeof document !== 'undefined'
                  ? document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? ''
                  : ''),
              },
              body: JSON.stringify({ pi_payment_id: p.identifier }),
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
      this._lastRawError    = null;
      window.__TEC_PI_AUTHENTICATED = true;

      this._log('info', 'auth:success', `version=${currentVersion}`);
      window.dispatchEvent(new CustomEvent('tec:pi:auth:success', {
        detail: { version: currentVersion, ts: Date.now() },
      }));
      return { ok: true };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this._lastRawError = msg;
      this._log('warn', 'auth:raw-error', msg);

      let error: PiAuthError = 'UNKNOWN';
      if (msg === 'TIMEOUT')                                     error = 'TIMEOUT';
      else if (/cancel|denied|rejected|user.reject/i.test(msg)) error = 'USER_CANCELLED';
      else if (/scope|permission/i.test(msg))                    error = 'SCOPE_INVALID';
      else if (/not.initialized|call.init/i.test(msg))          error = 'SDK_MISSING';
      else if (!window.Pi)                                       error = 'SDK_MISSING';
      return this._fail(error);
    } finally {
      this.authPromise = null;
    }
  }

  private _fail(error: PiAuthError): PiAuthResult {
    this.authenticated            = false;
    this.hasPaymentsScope         = false;
    this._lastError               = error;
    window.__TEC_PI_AUTHENTICATED = false;
    this._log('warn', 'auth:failed', error);
    window.dispatchEvent(new CustomEvent('tec:pi:auth:failed', { detail: { error, ts: Date.now() } }));
    return { ok: false, error };
  }

  reset(): void {
    this.authenticated            = false;
    this.hasPaymentsScope         = false;
    this.authPromise              = null;
    this.paymentsReadyPromise     = null;
    this.lastAuthAt               = 0;
    this.paymentInFlight          = false;
    this.paymentLockAt            = 0;
    this._lastError               = null;
    this._lastRawError            = null;
    window.__TEC_PI_AUTHENTICATED = false;
    this._log('info', 'auth:reset', 'session cleared');
  }

  private _log(level: 'info' | 'warn' | 'error', event: string, detail?: string): void {
    const payload = { event, detail, ts: Date.now(), version: this.authVersion };
    if (level === 'info')  console.info('[PiSession]',  payload);
    if (level === 'warn')  console.warn('[PiSession]',  payload);
    if (level === 'error') console.error('[PiSession]', payload);
  }

  get isAuthenticated():  boolean            { return this.authenticated; }
  get hasScope():         boolean            { return this.hasPaymentsScope; }
  get isPaymentLocked():  boolean            { return this.paymentInFlight; }
  get lastError():        PiAuthError | null { return this._lastError; }
  get lastRawError():     string | null      { return this._lastRawError; }
}

export const piSession = new PiSessionManager();
