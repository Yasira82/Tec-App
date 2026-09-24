import { PiAuthResult, TecAuthResponse, PiPaymentData, PiPaymentCallbacks } from '@/types/pi.types';
import sdk from '@/lib/sdk';
import { tecSession } from '@/lib-client/pi/tec-session';
import { piSession }  from '@/lib-client/pi/pi-session';
import { piScopes }  from '@/lib-client/pi/scopes';

declare global {
  interface Window {
    Pi: {
      authenticate: (
        scopes: string[],
        onIncompletePayment: (payment: unknown) => void
      ) => Promise<PiAuthResult>;
      createPayment: (paymentData: PiPaymentData, callbacks: PiPaymentCallbacks) => void;
      init: (config: { version: string; sandbox: boolean; appId?: string }) => void;
    };
    __PI_SANDBOX?:   boolean;
    __TEC_PI_READY?: boolean;
    __TEC_PI_ERROR?: boolean;
  }
}

const ERRORS = {
  NOT_PI_BROWSER:
    'Please open the app inside Pi Browser to authenticate.\n' +
    'Instructions: Open Pi Network app → Apps → TEC App',
  SDK_LOAD_FAILED:
    'Pi SDK failed to load. Please check your internet connection and try again.',
  SDK_INIT_FAILED:
    'Pi SDK initialization failed. Please try again.',
  // Not "check your internet". This fires when `Pi.authenticate` never
  // answers — the bridge stays silent, it does not fail (C-02, C-76), and the
  // server is never reached. Every request before and after it went through,
  // so pointing at the connection sent people hunting the one thing that was
  // working. The cure is a fresh page, which is what closing and reopening
  // was doing by hand.
  AUTH_TIMEOUT:
    'Pi did not respond. Tap "Try again" to reload the page.',
  SAVE_FAILED:
    'Failed to save authentication data. Please ensure private browsing mode is disabled.',
};

/** True when a sign-in failed because Pi never answered — not a network error. */
export const isPiSilent = (err: unknown): boolean =>
  err instanceof Error && err.message === ERRORS.AUTH_TIMEOUT;

export const isPiBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  return typeof window.Pi !== 'undefined' && typeof window.Pi.authenticate === 'function';
};

export const getAccessToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const match = document.cookie
      .split('; ')
      .find(row => row.startsWith('tec_access_token='));
    if (!match) return null;
    return match.substring(match.indexOf('=') + 1);
  } catch { return null; }
};

export const getRefreshToken = (): string | null => null;

export const getStoredUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const match = document.cookie
      .split('; ')
      .find(row => row.startsWith('tec_user='));
    if (!match) return null;
    const value = match.substring(match.indexOf('=') + 1);
    return JSON.parse(decodeURIComponent(value));
  } catch { return null; }
};

export const logout = async () => {
  tecSession.clear();
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-csrf-token': getCsrfToken() },
    });
    sdk.clearAuthToken();
  } catch (err) {
    console.error('[Pi Auth] Logout failed:', err);
  }
};

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

export const refreshAccessToken = async (): Promise<string | null> => {
  if (isRefreshing) {
    return new Promise(resolve => { refreshQueue.push(resolve); });
  }
  isRefreshing = true;
  try {
    const res = await fetch('/api/auth/refresh', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'x-csrf-token': getCsrfToken() },
    });
    if (!res.ok) {
      // Do NOT logout here. Refresh can fail transiently (rotated token racing,
      // Pi Browser cookie quirks) — destroying the whole session turned that
      // into a logout→login loop in production. Fail quiet; the BFF's
      // server-side refresh is the authoritative renewal path.
      refreshQueue.forEach(cb => cb(null));
      refreshQueue = [];
      return null;
    }
    const data = await res.json();
    refreshQueue.forEach(cb => cb(data.token ?? null));
    refreshQueue = [];
    return data.token ?? null;
  } catch (err) {
    console.error('[Pi Auth] Refresh failed:', err);
    refreshQueue.forEach(cb => cb(null));
    refreshQueue = [];
    return null;
  } finally {
    isRefreshing = false;
  }
};

export const fetchWithAuth = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) return res;
    return fetch(url, { ...options, credentials: 'include' });
  }
  return res;
};

export const resolvePendingPayment = async (
  piPaymentId: string
): Promise<{ action: string } | null> => {
  try {
    await sdk.payment.resolveIncomplete(piPaymentId);
    return { action: 'resolved' };
  } catch (err) {
    _captureError('resolvePendingPayment failed', { piPaymentId, error: String(err) });
    return null;
  }
};

// ── Sentry Helpers ────────────────────────────────────────
const _captureError = (message: string, data: Record<string, unknown>): void => {
  try {
    import('@sentry/nextjs').then(Sentry => {
      Sentry.captureMessage(`[Pi Recovery] ${message}`, {
        level: 'error',
        extra: data,
        tags:  { component: 'pi-auth', type: 'incomplete-payment' },
      });
    }).catch(() => {});
  } catch {}
};

const _reportResolved = (piPaymentId: string, via: string, action?: unknown): void => {
  try {
    import('@sentry/nextjs').then(Sentry => {
      Sentry.addBreadcrumb({
        category: 'pi.payment',
        message:  `Payment resolved via ${via}`,
        level:    'info',
        data:     { piPaymentId, via, action },
      });
    }).catch(() => {});
  } catch {}
};

const _addBreadcrumb = (message: string, data: Record<string, unknown>): void => {
  try {
    import('@sentry/nextjs').then(Sentry => {
      Sentry.addBreadcrumb({
        category: 'pi.payment',
        message,
        level:    'warning',
        data,
      });
    }).catch(() => {});
  } catch {}
};

// ── Helper — قراءة CSRF token من الـ cookie ───────────────
const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('tec_csrf='))
    ?.split('=')?.[1] ?? '';
};

// ── Resolve Incomplete Payment — بعد الـ login ────────────
let _pendingPaymentId: string | null = null;

interface IncompletePayment {
  identifier?: string;
}

const handleIncompletePayment = (payment: unknown): void => {
  const p           = payment as IncompletePayment;
  const piPaymentId = p?.identifier;
  if (!piPaymentId) return;

  _pendingPaymentId = piPaymentId;
  _addBreadcrumb('Incomplete payment detected — will resolve after login', { piPaymentId });
};

const resolveIncompleteAfterLogin = async (piPaymentId: string): Promise<void> => {
  const csrfToken = getCsrfToken();

  // ── Step 1: Backend ──────────────────────────────────────
  try {
    const res = await fetch('/api/payment/resolve-incomplete', {
      method:      'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        // ✅ CSRF token — بدونه الـ middleware بيرجع 403
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({ pi_payment_id: piPaymentId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      _reportResolved(piPaymentId, 'backend', data?.action);
      return;
    }
    _captureError('resolve-incomplete backend failed', { piPaymentId, status: res.status, data });
  } catch (err) {
    _captureError('resolve-incomplete network error', { piPaymentId, error: String(err) });
  }

  // ── Step 2: SDK ───────────────────────────────────────────
  try {
    const result = await sdk.payment.resolveIncomplete(piPaymentId);
    _reportResolved(piPaymentId, 'sdk', result?.status);
    return;
  } catch (sdkErr) {
    _captureError('SDK resolve failed', { piPaymentId, error: String(sdkErr) });
  }

  // ── Step 3: Cancel ────────────────────────────────────────
  try {
    const res = await fetch('/api/payment/cancel', {
      method:      'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({ pi_payment_id: piPaymentId }),
    });
    if (res.ok) {
      _reportResolved(piPaymentId, 'cancel');
    } else {
      _captureError('All recovery attempts failed', { piPaymentId, cancelStatus: res.status });
    }
  } catch (err) {
    _captureError('Cancel network error', { piPaymentId, error: String(err) });
  }
};

// ── SDK Wait ──────────────────────────────────────────────
export const waitForPiSDK = (timeout = 15000): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.__TEC_PI_ERROR) {
      reject(new Error(ERRORS.SDK_LOAD_FAILED));
      return;
    }
    if (typeof window !== 'undefined' && typeof window.Pi !== 'undefined' && window.__TEC_PI_READY) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      window.removeEventListener('tec-pi-ready', onReady);
      window.removeEventListener('tec-pi-error', onError);
      reject(new Error(ERRORS.SDK_LOAD_FAILED));
    }, timeout);
    const onReady = () => {
      clearTimeout(timer);
      window.removeEventListener('tec-pi-error', onError);
      resolve();
    };
    const onError = () => {
      clearTimeout(timer);
      window.removeEventListener('tec-pi-ready', onReady);
      reject(new Error(ERRORS.SDK_INIT_FAILED));
    };
    window.addEventListener('tec-pi-ready', onReady, { once: true });
    window.addEventListener('tec-pi-error', onError, { once: true });
  });
};

const getAuthTimeout = (): number => {
  const envTimeout = process.env.NEXT_PUBLIC_PI_AUTH_TIMEOUT
    ? parseInt(process.env.NEXT_PUBLIC_PI_AUTH_TIMEOUT, 10)
    : 45000;
  return !isNaN(envTimeout) && envTimeout > 0 ? envTimeout : 45000;
};

/**
 * Login's Pi.authenticate — through the SAME gate as the payment modal's.
 *
 * This was the second, independent authenticate in the app. Pi Browser breaks
 * on concurrent authenticate calls, and nothing connected these two: login
 * waits 45s, the modal waits 25s, and neither knew the other existed. When
 * they overlapped the modal's call was simply never answered and died on its
 * own timeout as `Pi auth (TIMEOUT): TIMEOUT`.
 *
 * It only ever showed on the paired Testnet host, and for a reason that has
 * nothing to do with payments: hub.tecosystem.app already holds a session, so
 * login does not run there. The Testnet host is a different origin with its
 * own cookies, so login runs on arrival — exactly when a Mode-1 modal opens.
 *
 * The gate serializes rather than cancels: whichever call arrives second waits
 * for the first and then runs normally. The timeout below still measures only
 * this call, because the wait happens before it starts.
 */
const authenticateWithTimeout = async (timeout?: number): Promise<PiAuthResult> => {
  const effectiveTimeout = timeout ?? getAuthTimeout();
  await waitForPiSDK();
  return piSession.withAuthGate(() => new Promise<PiAuthResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(isPiBrowser() ? ERRORS.AUTH_TIMEOUT : ERRORS.NOT_PI_BROWSER));
    }, effectiveTimeout);
    window.Pi.authenticate(piScopes(), handleIncompletePayment)
      .then(result => {
        clearTimeout(timer);
        // Tell the session manager this succeeded, so the first Pay tap does
        // not run a SECOND authenticate for a session it already has. Same
        // scopes, so nothing is widened — and "same" is now a shared constant
        // rather than two lists that happen to match today. Without this the
        // modal queued behind login on the gate and burned its own 25s budget
        // waiting — and the retry a minute later "worked" only because
        // `authenticated` was then already true.
        piSession.markAuthenticated();
        resolve(result);
      })
      .catch(err   => { clearTimeout(timer); reject(err);     });
  }));
};

// ── Login with Pi ─────────────────────────────────────────
/**
 * Which half of a sign-in is running — so the screen can say where it is.
 *
 *   'pi'     — waiting on `Pi.authenticate`. The half that hangs: when Pi
 *              Browser's app context belongs to another app (a Quest visit
 *              runs each app's own `Pi.init`), the bridge simply never replies.
 *   'server' — Pi answered; our own `/api/auth/pi-login` is creating the
 *              session. Seen in the logs at under a second.
 */
export type LoginStage = 'pi' | 'server';

export const loginWithPi = async (
  opts: { onStage?: (stage: LoginStage) => void } = {},
): Promise<TecAuthResponse> => {
  if (!isPiBrowser()) {
    throw new Error(ERRORS.NOT_PI_BROWSER);
  }

  _pendingPaymentId = null;

  opts.onStage?.('pi');
  const piAuth = await authenticateWithTimeout();
  opts.onStage?.('server');

  const res = await fetch('/api/auth/pi-login', {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
    // The scopes THIS sign-in asked Pi for, so the platform can stop guessing
    // who still needs to re-consent. Pi cannot widen a consent already given,
    // so an account that signed in before `wallet_address` was requested must
    // sign in once more before it can be paid — and nothing recorded which
    // accounts those were. It authorizes nothing: auth stores it only to
    // decide whether to remind this person.
    body:        JSON.stringify({ accessToken: piAuth.accessToken, scopes: piScopes() }),
  });

  if (!res.ok) {
    throw new Error(ERRORS.SAVE_FAILED);
  }

  const data = await res.json();

  // C-123 §7 — hold the session in MEMORY: the cookie-independent transport.
  // BFF calls attach it as an Authorization header, so the app works even in
  // Pi Browser contexts that refuse cookies entirely.
  if (data?.accessToken && data?.user) {
    tecSession.set(data.accessToken, data.user);
  }

  // ✅ الآن فيه cookie + CSRF — نعالج الـ incomplete payment
  if (_pendingPaymentId) {
    void resolveIncompleteAfterLogin(_pendingPaymentId);
    _pendingPaymentId = null;
  }

  _registerFCMToken(piAuth.accessToken).catch(() => {});

  return {
    success:   data.success,
    isNewUser: data.isNewUser,
    user: {
      id:               data.user.id,
      piId:             data.user.piId,
      piUsername:       data.user.piUsername,
      role:             data.user.role,
      subscriptionPlan: data.user.subscriptionPlan,
      createdAt:        data.user.createdAt,
    },
    tokens: {
      accessToken:  data.accessToken ?? '',
      refreshToken: '',
    },
    // Present when the server minted a one-time token: the button finishes
    // login by top-level navigating to /api/auth/sso-callback (see pi-login).
    ssoToken: data.ssoToken,
  };
};

// ── FCM Token Registration ────────────────────────────────
const _registerFCMToken = async (accessToken: string): Promise<void> => {
  try {
    const { getFCMToken } = await import('@/lib/firebase');
    const fcmToken = await getFCMToken();
    if (!fcmToken) return;

    await fetch('/api/bff/notifications/device-tokens', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
      body:        JSON.stringify({ token: fcmToken, platform: 'web' }),
    });
  } catch (err: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Pi Auth] FCM token registration failed:', (err as Error).message);
    }
  }
};
