'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * The CANONICAL Pro/plan resolver for the Hub.
 *
 * Subscription is commerce-owned (C-47). The auth session is NOT the source of truth:
 * `/me` never carries the plan (login hardcodes `subscriptionPlan: null`), so reading
 * `user.subscriptionPlan` reports "Free" to paying Pro/Enterprise users. Always read
 * the live status through this hook — do NOT hand-roll another parser.
 *
 * The status envelope is NESTED — `{ data: { subscription: { plan, isActive, ... } } }`.
 * Reading `.data.plan` (flat) is the exact bug that once locked Pro OFF fleet-wide, so
 * the unwrap lives here in ONE place, with flat/bare fallbacks, failing closed to FREE (P6).
 */
export interface PlanState {
  /** Uppercase plan id — 'FREE' | 'PRO' | 'ENTERPRISE'. */
  plan:     string;
  /** True only for a paid plan that is active and not expired (no auto-renewal). */
  isPaid:   boolean;
  /** Days left in the current period, when commerce reports it. */
  daysRemaining: number | null;
  isExpired: boolean;
  loading:  boolean;
  refresh:  () => Promise<void>;
}

export function resolvePlan(raw: unknown): Omit<PlanState, 'loading' | 'refresh'> {
  const d = raw as { data?: { subscription?: Record<string, unknown> } & Record<string, unknown> } & Record<string, unknown>;
  const s = (d?.data?.subscription ?? d?.data ?? d) as Record<string, unknown> | undefined;

  const plan      = typeof s?.plan === 'string' ? s.plan.toUpperCase() : 'FREE';
  const active    = s?.isActive  !== false;   // absent → assume active, plan gates it
  const isExpired = s?.isExpired === true;
  const days      = typeof s?.daysRemaining === 'number' ? s.daysRemaining : null;

  return { plan, isPaid: plan !== 'FREE' && active && !isExpired, daysRemaining: days, isExpired };
}

export function useSubscriptionPlan(enabled = true): PlanState {
  const [state, setState] = useState<Omit<PlanState, 'loading' | 'refresh'>>({
    plan: 'FREE', isPaid: false, daysRemaining: null, isExpired: false,
  });
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await fetch('/api/subscriptions?endpoint=status', {
        credentials: 'include', cache: 'no-store',
      });
      if (res.ok) setState(resolvePlan(await res.json()));
      // A failed read leaves the previous (fail-closed) value — never invents a plan.
    } catch {
      /* fail closed — keep FREE */
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { refresh(); }, [refresh]);

  return { ...state, loading, refresh };
}
