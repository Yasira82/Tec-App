// Server-side only (imported exclusively by BFF route handlers). Not marked
// with `server-only` because that package throws under the unit-test runtime;
// the module makes network calls and is never imported by client components.
import { normalizePlan, entitlementsFor, type PlanId } from './entitlements';

const GATEWAY = process.env.API_GATEWAY_URL ?? '';

export type QuotaCheck =
  | { allowed: true }
  | { allowed: false; plan: PlanId; limit: number; owned: number };

// Shared asset-quota gate used by EVERY asset-provisioning entry point so the
// FREE cap can't be bypassed by picking a different route. Fails OPEN (allowed)
// whenever the plan is unlimited or the owned count can't be read — never blocks
// an already-paid provision over a backend blip.
export async function checkAssetQuota(token: string, userId: string): Promise<QuotaCheck> {
  const plan  = await fetchUserPlan(token);
  const limit = entitlementsFor(plan).assetLimit;
  if (!Number.isFinite(limit)) return { allowed: true };
  const owned = await countUserAssets(token, userId);
  if (owned === null || owned < limit) return { allowed: true };
  return { allowed: false, plan, limit, owned };
}

// Resolve a user's current plan from the commerce subscription service, using
// their access token. Fail-CLOSED to FREE — if we can't confirm a paid plan we
// treat the caller as FREE (never grant premium on doubt, P6).
export async function fetchUserPlan(token: string): Promise<PlanId> {
  if (!token || !GATEWAY) return 'FREE';
  try {
    const res = await fetch(`${GATEWAY}/api/commerce/subscriptions/status`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      cache:   'no-store',
    });
    if (!res.ok) return 'FREE';
    const json = await res.json().catch(() => ({}));
    const sub  = json?.data?.subscription ?? json?.data ?? json;
    // Only an ACTIVE subscription grants its plan; anything else → FREE.
    const status = String(sub?.status ?? '').toUpperCase();
    if (status && status !== 'ACTIVE') return 'FREE';
    return normalizePlan(sub?.plan);
  } catch {
    return 'FREE';
  }
}

// Count a user's provisioned assets (for the FREE asset cap). Returns null when
// the count can't be determined — callers should fail-OPEN on null so a backend
// blip never blocks a legitimate, already-paid provision.
export async function countUserAssets(token: string, userId: string): Promise<number | null> {
  if (!token || !GATEWAY || !userId) return null;
  try {
    const res = await fetch(`${GATEWAY}/api/assets/user/${encodeURIComponent(userId)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => ({}));
    const arr  = json?.data ?? json?.assets ?? json;
    return Array.isArray(arr) ? arr.length : null;
  } catch {
    return null;
  }
}
