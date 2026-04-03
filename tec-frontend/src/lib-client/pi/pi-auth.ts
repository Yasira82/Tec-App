import { PiAuthResult, TecAuthResponse, PiPaymentData, PiPaymentCallbacks } from '@/types/pi.types';
import sdk from '@/lib/sdk';

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
  AUTH_TIMEOUT:
    'Authentication timed out. Please check your internet connection and try again.',
  SAVE_FAILED:
    'Failed to save authentication data. Please ensure private browsing mode is disabled.',
};

export const isPiBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  return typeof window.Pi !== 'undefined' && typeof window.Pi.authenticate === 'function';
};

// ✅ Token في HttpOnly cookie — مش accessible من JS
// الـ BFF routes بترسله تلقائياً مع كل request
export const getAccessToken = (): string | null => null;

// ✅ Refresh token في HttpOnly cookie — BFF يتعامل معاه
export const getRefreshToken = (): string | null => null;

// ✅ User info من cookie مش HttpOnly
export const getStoredUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const match = document.cookie
      .split('; ')
      .find(row => row.startsWith('tec_user='));
    if (!match) return null;
    return JSON.parse(decodeURIComponent(match.split('=')[1]));
  } catch { return null; }
};

// ✅ Logout — BFF يمسح الـ cookies
export const logout = async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    sdk.clearAuthToken();
  } catch (err) {
    console.error('[Pi Auth] Logout failed:', err);
  }
};

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

// ✅ Refresh — BFF يتولى قراءة الـ refresh cookie وإرجاع access token جديد
export const refreshAccessToken = async (): Promise<string | null> => {
  if (isRefreshing) {
    return new Promise(resolve => { refreshQueue.push(resolve); });
  }
  isRefreshing = true;
  try {
    const res = await fetch('/api/auth/refresh', {
      method:      'POST',
      credentials: 'include', // يبعت الـ cookies تلقائياً
    });
    if (!res.ok) {
      await logout();
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
    await logout();
    refreshQueue.forEach(cb => cb(null));
    refreshQueue = [];
    return null;
  } finally {
    isRefreshing = false;
  }
};

// ✅ fetchWithAuth — الـ cookies بتتبعت تلقائياً مع credentials: 'include'
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
    }).catch(() => { /* Sentry optional */ });
  } catch { /* Sentry optional */ }
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
    }).catch(() => { /* Sentry optional */ });
  } catch { /* Sentry optional */ }
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
    }).catch(() => { /* Sentry optional */ });
  } catch { /* Sentry optional */ }
};

// ── Resolve Incomplete Payment ────────────────────────────
const resolveIncompletePayment = async (payment: unknown): Promise<void> => {
  const p           = payment as { identifier?: string };
  const piPaymentId = p?.identifier;
  if (!piPaymentId) return;

  _addBreadcrumb('Incomplete payment detected', { piPaymentId });

  // ── Step 1: Backend resolve-incomplete ───────────────────
  try {
    const res = await fetch('/api/payment/resolve-incomplete', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ pi_payment_id: piPaymentId }),
    });
    const data = await res.json();
    if (res.ok) {
      _reportResolved(piPaymentId, 'backend', data?.action);
      return;
    }
    _captureError('resolve-incomplete backend failed', { piPaymentId, status: res.status, data });
  } catch (err) {
    _captureError('resolve-incomplete network error', { piPaymentId, error: String(err) });
  }

  // ── Step 2: SDK resolve fallback ─────────────────────────
  try {
    const result = await sdk.payment.resolveIncomplete(piPaymentId);
    _reportResolved(piPaymentId, 'sdk', result?.status);
    return;
  } catch (sdkErr) {
    _captureError('SDK resolve failed', { piPaymentId, error: String(sdkErr) });
  }

  // ── Step 3: Cancel via backend ───────────────────────────
  try {
    const res = await fetch('/api/payment/cancel', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ pi_payment_id: piPaymentId }),
    });
    if (res.ok) {
      _reportResolved(piPaymentId, 'cancel');
    } else {
      _captureError('All recovery attempts failed', { piPaymentId, cancelStatus: res.status });
    }
  } catch (err) {
    _captureError('Cancel network error — payment requires manual review', {
      piPaymentId,
      error: String(err),
    });
  }
};

const handleIncompletePayment = (payment: unknown): void => {
  void resolveIncompletePayment(payment);
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

const authenticateWithTimeout = async (timeout?: number): Promise<PiAuthResult> => {
  const effectiveTimeout = timeout ?? getAuthTimeout();
  await waitForPiSDK();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(isPiBrowser() ? ERRORS.AUTH_TIMEOUT : ERRORS.NOT_PI_BROWSER));
    }, effectiveTimeout);
    window.Pi.authenticate(['username', 'payments'], handleIncompletePayment)
      .then(result => { clearTimeout(timer); resolve(result); })
      .catch(err   => { clearTimeout(timer); reject(err);     });
  });
};

// ── Login with Pi ─────────────────────────────────────────
export const loginWithPi = async (): Promise<TecAuthResponse> => {
  if (!isPiBrowser()) {
    throw new Error(ERRORS.NOT_PI_BROWSER);
  }

  const piAuth = await authenticateWithTimeout();

  // ✅ BFF route يضبط الـ HttpOnly cookies
  const res = await fetch('/api/auth/pi-login', {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify({ accessToken: piAuth.accessToken }),
  });

  if (!res.ok) {
    throw new Error(ERRORS.SAVE_FAILED);
  }

  const data = await res.json();

  _registerFCMToken(piAuth.accessToken).catch(() => { /* ignore */ });

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
      accessToken:  '', // مش بنكشفه للـ client — في HttpOnly cookie
      refreshToken: '', // مش بنكشفه للـ client — في HttpOnly cookie
    },
  };
};

// ── FCM Token Registration ────────────────────────────────
const _registerFCMToken = async (accessToken: string): Promise<void> => {
  try {
    const { getFCMToken } = await import('@/lib/firebase');
    const fcmToken = await getFCMToken();
    if (!fcmToken) return;

    await fetch('/api/notifications/device-tokens', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ token: fcmToken, platform: 'web' }),
    });
  } catch { /* non-blocking */ }
};
