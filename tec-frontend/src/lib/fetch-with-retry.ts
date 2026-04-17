interface FetchWithRetryOptions extends RequestInit {
  maxRetries?: number;
  baseDelay?:  number;
  onRetry?:    (attempt: number, error: Error) => void;
}

const RETRIABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export async function fetchWithRetry(
  url:     string,
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const { maxRetries = 3, baseDelay = 500, onRetry, ...fetchOptions } = options;

  let lastError: Error = new Error('Request failed');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, fetchOptions);

      if (!RETRIABLE_STATUS.has(res.status) || attempt === maxRetries) {
        return res;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      onRetry?.(attempt, new Error(`HTTP ${res.status}`));
      await new Promise<void>(resolve => setTimeout(resolve, delay));

    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error('Network error');
      if (attempt === maxRetries) break;

      const delay = baseDelay * Math.pow(2, attempt - 1);
      onRetry?.(attempt, lastError);
      await new Promise<void>(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
