/**
 * Request ID utilities — correlation tracking across Frontend + Backend
 */

const REQUEST_ID_KEY = 'tec_last_request_id';

/** Generate a new UUID v4 requestId */
export const generateRequestId = (): string => crypto.randomUUID();

/** Store the last requestId for debugging */
export const storeRequestId = (requestId: string): void => {
  try {
    sessionStorage.setItem(REQUEST_ID_KEY, requestId);
  } catch { /* ignore */ }
};

/** Get the last stored requestId */
export const getLastRequestId = (): string | null => {
  try {
    return sessionStorage.getItem(REQUEST_ID_KEY);
  } catch { return null; }
};

/**
 * Build standard headers with requestId + auth token
 */
export const buildHeaders = (
  token?: string | null,
  extra?: Record<string, string>,
): Record<string, string> => {
  const requestId = generateRequestId();
  storeRequestId(requestId);

  return {
    'Content-Type': 'application/json',
    'X-Request-ID': requestId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
};
