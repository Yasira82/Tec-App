import { useState, useEffect, useCallback } from 'react';
import { checkBackendHealth, HealthStatus } from '../lib/health-check';

export function useBackendHealth(intervalMs = 0, initialDelayMs = 3000) {
  // ✅ ابدأ بـ online: true — متفرجيش Banner في البداية
  const [health,     setHealth]     = useState<HealthStatus>({ online: true });
  const [isChecking, setIsChecking] = useState(true);

  const check = useCallback(async () => {
    setIsChecking(true);
    const result = await checkBackendHealth();
    setHealth(result);
    setIsChecking(false);
    return result;
  }, []);

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
