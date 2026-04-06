/**
 * Wraps the native `fetch` with a hard timeout using AbortController.
 * Falls back to the standard 503 error flow if the timeout is exceeded.
 *
 * @param input    - URL string or Request object
 * @param init     - Standard RequestInit options
 * @param timeoutMs - Milliseconds before the request is aborted (default: 5000)
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 5000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
