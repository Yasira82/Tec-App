'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAccessToken }                   from '@/lib-client/pi/pi-auth';
import { entitlementsFor, normalizePlan, type PlanId, type Entitlements } from '@/lib/subscription/entitlements';

interface EntitlementsState {
  plan:         PlanId;
  entitlements: Entitlements;
  assetsUsed:   number | null; // null = unknown
  loading:      boolean;
  refresh:      () => void;
}

// Reads the caller's live plan + asset usage so the UI can reflect REAL
// capabilities (locks, "x of N used", upgrade prompts) — the same entitlements
// the BFF enforces. Cookie-auth via credentials:'include' (token is HttpOnly).
export function useEntitlements(): EntitlementsState {
  const [plan,       setPlan]       = useState<PlanId>('FREE');
  const [assetsUsed, setAssetsUsed] = useState<number | null>(null);
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const token = getAccessToken();
    const auth  = token ? { Authorization: `Bearer ${token}` } : undefined;
    try {
      const [subRes, assetsRes] = await Promise.all([
        fetch('/api/subscriptions?endpoint=status', { credentials: 'include', headers: auth }),
        fetch('/api/bff/assets/list',               { credentials: 'include', headers: auth }),
      ]);
      if (subRes.ok) {
        const j   = await subRes.json().catch(() => ({}));
        const sub = j?.data?.subscription ?? j?.data ?? j;
        const status = String(sub?.status ?? '').toUpperCase();
        setPlan(status && status !== 'ACTIVE' ? 'FREE' : normalizePlan(sub?.plan));
      }
      if (assetsRes.ok) {
        const j   = await assetsRes.json().catch(() => ({}));
        const arr = j?.data ?? j?.assets ?? j;
        setAssetsUsed(Array.isArray(arr) ? arr.length : (typeof j?.total === 'number' ? j.total : null));
      }
    } catch { /* keep FREE defaults */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { plan, entitlements: entitlementsFor(plan), assetsUsed, loading, refresh: load };
}
