/**
 * Structured logging + error reporting — the single choke-point for observability
 * (C-96: a silent catch is an invisible failure). Use `log.*` for structured events
 * and `reportError` inside catch blocks instead of swallowing the error.
 *
 * Sentry-ready: `reportError` forwards to a globally-initialized Sentry when present
 * (the one swap-point). Everything here is guarded so logging NEVER throws.
 */
type Level = 'info' | 'warn' | 'error';

function emit(level: Level, msg: string, ctx?: Record<string, unknown>): void {
  try {
    const line = JSON.stringify({ level, msg, ...(ctx ?? {}), ts: new Date().toISOString() });
    (console[level] ?? console.log)(line);
  } catch {
    /* never throw from logging */
  }
}

export const log = {
  info:  (msg: string, ctx?: Record<string, unknown>) => emit('info', msg, ctx),
  warn:  (msg: string, ctx?: Record<string, unknown>) => emit('warn', msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => emit('error', msg, ctx),
};

/** Report a caught error: structured log + Sentry (when a global Sentry is present). */
export function reportError(err: unknown, ctx?: Record<string, unknown>): void {
  const message = err instanceof Error ? err.message : String(err);
  log.error(message, ctx);
  try {
    const g = globalThis as unknown as {
      Sentry?: { captureException?: (e: unknown, c?: unknown) => void };
    };
    g.Sentry?.captureException?.(err, ctx ? { extra: ctx } : undefined);
  } catch {
    /* ignore — reporting must never throw */
  }
}
