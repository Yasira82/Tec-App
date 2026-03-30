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
    __PI_SANDBOX?:    boolean;
    __TEC_PI_READY?:  boolean;
    __TEC_PI_ERROR?:  boolean;
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

export const getAccessToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem('tec_access_token'); } catch { return null; }
};

export const getRefreshToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem('tec_refresh_token'); } catch { return null; }
};

export const getStoredUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const userData = localStorage.getItem('tec_user');
    return userData ? JSON.parse(userData) : null;
  } catch { return null; }
};

export const logout = () => {
  try {
    localStorage.removeItem('tec_access_token');
    localStorage.removeItem('tec_refresh_token');
    localStorage.removeItem('tec_user');
    sdk.clearAuthToken();
  } catch (err) {
    console.error('[Pi Auth] Failed to clear localStorage:', err);
  }
};

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

export const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) { logout(); return null; }

  if (isRefreshing) {
    return new Promise((resolve) => { refreshQueue.push(resolve); });
  }

  isRefreshing = true;
  try {
    const res           = await sdk.auth.refreshToken();
    const newAccessToken = res.token;
    if (!newAccessToken) {
      logout();
      refreshQueue.forEach(cb => cb(null));
      refreshQueue = [];
      return null;
    }
    localStorage.setItem('tec_access_token', newAccessToken);
    sdk.setAuthToken(newAccessToken);
    refreshQueue.forEach(cb => cb(newAccessToken));
    refreshQueue = [];
    return newAccessToken;
  } catch (err) {
    console.error('[Pi Auth] Refresh failed:', err);
    logout();
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
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) return res;
    return fetch(url, { ...options, headers: { ...headers, Authorization: `Bearer ${newToken}` } });
  }
  return res;
};

export const resolvePendingPayment = async (
  piPaymentId: string
): Promise<{ action: string } | null> => {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const result = await sdk.payment.resolveIncomplete(piPaymentId);
    return { action: result?.data?.action ?? 'resolved' };
  } catch (err) {
    console.error('[Pi Auth] Error resolving pending payment:', err);
    return null;
  }
};

// ✅ الحل الجذري — cancel الـ pending payment عبر الـ backend
const resolveIncompletePayment = async (payment: unknown) => {
  const p          = payment as { identifier?: string; status?: string };
  const piPaymentId = p?.identifier;
  if (!piPaymentId) return;

  console.log('[Pi Auth] Incomplete payment detected:', piPaymentId);

  const token = getAccessToken();

  // ── أولاً: جرب SDK resolve ──────────────────────────────
  try {
    const result = await sdk.payment.resolveIncomplete(piPaymentId);
    console.log('[Pi Auth] SDK resolved:', result?.data?.action);
    return;
  } catch (sdkErr) {
    console.warn('[Pi Auth] SDK resolve failed, trying backend cancel:', sdkErr);
  }

  // ── ثانياً: cancel عبر الـ backend ────────────────────
  if (!token) return;
  try {
    const res = await fetch('/api/payment/cancel', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${token}`,
      },
      body: JSON.stringify({ pi_payment_id: piPaymentId }),
    });
    if (res.ok) {
      console.log('[Pi Auth] Backend cancelled pending payment:', piPaymentId);
    } else {
      console.warn('[Pi Auth] Backend cancel status:', res.status);
    }
  } catch (err) {
    console.error('[Pi Auth] Backend cancel failed:', err);
  }
};

const handleIncompletePayment = (payment: unknown) => {
  void resolveIncompletePayment(payment);
};

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

    const onError = (_event: Event) => {
      clearTimeout(timer);
      window.removeEventListener('tec-pi-ready', onReady);
      reject(new Error(ERRORS.SDK_INIT_FAILED));
    };

    window.addEventListener('tec-pi-ready', onReady,  { once: true });
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

export const loginWithPi = async (): Promise<TecAuthResponse> => {
  if (!isPiBrowser()) {
    throw new Error(ERRORS.NOT_PI_BROWSER);
  }

  const piAuth   = await authenticateWithTimeout();
  const response = await sdk.auth.loginWithPi(piAuth.accessToken);

  try {
    localStorage.setItem('tec_access_token',  response.tokens.accessToken);
    localStorage.setItem('tec_refresh_token', response.tokens.refreshToken);
    localStorage.setItem('tec_user',          JSON.stringify(response.user));
    sdk.setAuthToken(response.tokens.accessToken);
  } catch {
    throw new Error(ERRORS.SAVE_FAILED);
  }

  return {
    success:   response.success,
    isNewUser: response.isNewUser,
    user: {
      id:               response.user.id,
      piId:             response.user.piId,
      piUsername:       response.user.piUsername,
      role:             response.user.role,
      subscriptionPlan: response.user.subscriptionPlan,
      createdAt:        response.user.createdAt,
    },
    tokens: {
      accessToken:  response.tokens.accessToken,
      refreshToken: response.tokens.refreshToken,
    },
  };
};
