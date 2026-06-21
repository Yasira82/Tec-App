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

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { checkBackendHealth, type HealthStatus } from '../lib/health-check';

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
  // Start optimistic (online) + checking, so the banner never flashes on load.
  const [health, setHealth] = useState<HealthStatus>({ online: true });
  const [isChecking, setIsChecking] = useState(true);

  const recheck = useCallback(async () => {
    setIsChecking(true);
    const result = await checkBackendHealth();
    setHealth(result);
    setIsChecking(false);
    return result;
  }, []);

  useEffect(() => {
    // Delay the first check (cold-start grace) then poll on a single interval.
    const initial = setTimeout(recheck, initialDelayMs);
    const id = setInterval(recheck, intervalMs);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, [recheck, intervalMs, initialDelayMs]);

  return (
    <PlatformHealthCtx.Provider value={{ ...health, isChecking, recheck }}>
      {children}
    </PlatformHealthCtx.Provider>
  );
}

/** Read the centralized platform health. */
export function usePlatformHealth(): PlatformHealth {
  return useContext(PlatformHealthCtx);
}
