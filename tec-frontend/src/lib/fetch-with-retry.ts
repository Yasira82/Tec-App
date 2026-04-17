interface FetchWithRetryOptions extends RequestInit {
  maxRetries?: number;
  baseDelay?:  number;
  onRetry?:    (attempt: number, error: Error) => void;
}

export async function fetchWithRetry(
  url:     string,
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const { maxRetries = 3, baseDelay = 500, onRetry, ...fetchOptions } = options;

  const RETRIABLE = new Set([429, 500, 502, 503, 504]);

  let lastError: Error = new Error('Request failed');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, fetchOptions);

      if (!RETRIABLE.has(res.status) || attempt === maxRetries) return res;

      const delay = baseDelay * 2 ** (attempt - 1);
      onRetry?.(attempt, new Error(`HTTP ${res.status}`));
      await new Promise(r => setTimeout(r, delay));
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Network error');
      if (attempt === maxRetries) break;

      const delay = baseDelay * 2 ** (attempt - 1);
      onRetry?.(attempt, lastError);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError;
}
