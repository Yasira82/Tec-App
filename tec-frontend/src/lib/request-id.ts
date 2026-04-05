/**
 * Request ID utilities — correlation tracking across Frontend + Backend
 */

const REQUEST_ID_KEY = 'tec_last_request_id';

export const generateRequestId = (): string => crypto.randomUUID();

export const storeRequestId = (requestId: string): void => {
  try {
    sessionStorage.setItem(REQUEST_ID_KEY, requestId);
  } catch { /* ignore */ }
};

export const getLastRequestId = (): string | null => {
  try {
    return sessionStorage.getItem(REQUEST_ID_KEY);
  } catch { return null; }
};

// ✅ قراءة الـ CSRF token من الـ cookie
const getCsrfToken = (): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('tec_csrf='));
  return match ? match.split('=')[1] : null;
};

/**
 * Build standard headers with requestId + auth token + CSRF
 */
export const buildHeaders = (
  token?: string | null,
  extra?: Record<string, string>,
): Record<string, string> => {
  const requestId = generateRequestId();
  storeRequestId(requestId);

  const csrfToken = getCsrfToken();

  return {
    'Content-Type': 'application/json',
    'X-Request-ID': requestId,
    // ✅ CSRF token — مطلوب للـ POST/PUT/PATCH/DELETE
    ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
};
