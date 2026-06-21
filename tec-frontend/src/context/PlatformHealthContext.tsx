'use client';

/**
 * PlatformHealthContext — the single platform health runtime (C-96 / NEW-K).
 *
 * Before: BackendOfflineBanner and BackendStatus each ran their own 30s polling
 * loop against divergent endpoints (checkBackendHealth → /api/health BFF vs
 * checkGatewayHealth → server-only API_GATEWAY_URL, empty in the browser).
 * Two ungoverned polling loops + two fragmented state stores for the same signal.
 *
 * After: ONE poller, ONE cache, ONE status store. Every consumer reads from this
 * context via usePlatformHealth(). Health runtime is centralized (C-96 §Required
 * State). The canonical source is the /api/health BFF route (checkBackendHealth).
 */

import { createContext, useContext, type ReactNode } from 'react';
import { useBackendHealth } from '../hooks/useBackendHealth';
import { type HealthStatus } from '../lib/health-check';

export interface PlatformHealth extends HealthStatus {
  /** true while a health check is in flight */
  isChecking: boolean;
  /** force an immediate re-check (e.g. a Retry button) */
  recheck: () => Promise<HealthStatus>;
}

// Safe default for consumers rendered without a provider (e.g. isolated tests):
// assume online, no poller — never flashes an offline banner.
const DEFAULT: PlatformHealth = {
  online: true,
  isChecking: false,
  recheck: async () => ({ online: true }),
};

const PlatformHealthCtx = createContext<PlatformHealth>(DEFAULT);

export function PlatformHealthProvider({
  children,
  intervalMs = 30_000,
  initialDelayMs = 3_000,
}: {
  children: ReactNode;
  intervalMs?: number;
  initialDelayMs?: number;
}) {
  // The SINGLE health poller for the whole app (C-96). useBackendHealth is the
  // polling primitive; it is invoked here exactly once and shared via context.
  // No component may run its own poll — they consume usePlatformHealth().
  const { isChecking, recheckHealth, ...health } = useBackendHealth(
    intervalMs,
    initialDelayMs,
  );

  return (
    <PlatformHealthCtx.Provider
      value={{ ...(health as HealthStatus), isChecking, recheck: recheckHealth }}
    >
      {children}
    </PlatformHealthCtx.Provider>
  );
}

/** Read the centralized platform health. */
export function usePlatformHealth(): PlatformHealth {
  return useContext(PlatformHealthCtx);
}
