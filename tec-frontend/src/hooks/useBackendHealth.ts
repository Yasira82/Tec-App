import { useState, useEffect, useCallback, useRef } from 'react';
import { checkBackendHealth, HealthStatus } from '../lib/health-check';

// ✅ Resilience (NEW-Q): a single failed poll must NOT flip the banner to "offline".
// Require `failureThreshold` CONSECUTIVE failures before reporting offline — a
// transient blip (mobile jitter, brief Railway hiccup) is tolerated. Any success
// resets the counter. Combined with the aligned 12s/10s timeouts, this stops the
// false "Backend Offline" banner while the platform is actually healthy.
export function useBackendHealth(intervalMs = 0, initialDelayMs = 3000, failureThreshold = 2) {
  // ✅ ابدأ بـ online: true — متفرجيش Banner في البداية
  const [health,     setHealth]     = useState<HealthStatus>({ online: true });
  const [isChecking, setIsChecking] = useState(true);
  const failuresRef = useRef(0);

  const check = useCallback(async () => {
    setIsChecking(true);
    const result = await checkBackendHealth();
    if (result.online) {
      failuresRef.current = 0;
      setHealth(result);
    } else {
      failuresRef.current += 1;
      // only surface "offline" once failures reach the threshold; otherwise hold last state
      if (failuresRef.current >= failureThreshold) setHealth(result);
    }
    setIsChecking(false);
    return result;
  }, [failureThreshold]);

  useEffect(() => {
    // ✅ انتظر (افتراضي 3 ثواني) قبل أول check — cold-start grace
    const initial = setTimeout(() => check(), initialDelayMs);
    if (intervalMs > 0) {
      const id = setInterval(check, intervalMs);
      return () => { clearTimeout(initial); clearInterval(id); };
    }
    return () => clearTimeout(initial);
  }, [check, intervalMs, initialDelayMs]);

  return { ...health, isChecking, recheckHealth: check };
}
