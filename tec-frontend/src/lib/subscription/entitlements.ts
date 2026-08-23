// Subscription entitlements — the SINGLE SOURCE OF TRUTH for what each plan
// actually grants. Isomorphic (no server-only imports) so the BFF routes (to
// ENFORCE) and the UI (to DISPLAY honestly) read the exact same definitions.
//
// `enforced: true` on a feature means the platform actually gates it in code
// today. Everything else is honestly surfaced as "Coming soon" in the UI — we
// never take π for a capability that isn't wired up (Phase-0 honesty).

export type PlanId = 'FREE' | 'PRO' | 'ENTERPRISE';

export interface Entitlements {
  /** Max provisioned assets. Infinity = unlimited. ENFORCED at assets/provision. */
  assetLimit:       number;
  analyticsDashboard: boolean;
  commerceStore:    boolean;
  apiAccess:        boolean;
  customDomain:     boolean;
  whiteLabel:       boolean;
  supportTier:      'community' | 'priority' | 'dedicated';
}

export const ENTITLEMENTS: Record<PlanId, Entitlements> = {
  FREE: {
    assetLimit:         5,
    analyticsDashboard: false,
    commerceStore:      false,
    apiAccess:          false,
    customDomain:       false,
    whiteLabel:         false,
    supportTier:        'community',
  },
  PRO: {
    assetLimit:         Infinity,
    analyticsDashboard: true,
    commerceStore:      true,
    apiAccess:          false,
    customDomain:       false,
    whiteLabel:         false,
    supportTier:        'priority',
  },
  ENTERPRISE: {
    assetLimit:         Infinity,
    analyticsDashboard: true,
    commerceStore:      true,
    apiAccess:          true,
    customDomain:       true,
    whiteLabel:         true,
    supportTier:        'dedicated',
  },
};

export interface PlanMeta {
  id:      PlanId;
  name:    string;
  price:   number;      // π / month
  tagline: string;
  color:   string;
  icon:    string;
}

export const PLAN_META: Record<PlanId, PlanMeta> = {
  FREE:       { id: 'FREE',       name: 'Free',       price: 0,  tagline: 'Get started on TEC',                 color: '#6b7280', icon: '◯' },
  PRO:        { id: 'PRO',        name: 'Pro',        price: 10, tagline: 'For active builders & merchants',    color: '#F8B820', icon: '◈' },
  ENTERPRISE: { id: 'ENTERPRISE', name: 'Enterprise', price: 50, tagline: 'For teams & white-label businesses', color: '#7eb8f7', icon: '◉' },
};

export const PLAN_ORDER: PlanId[] = ['FREE', 'PRO', 'ENTERPRISE'];

// Feature comparison matrix for the pricing table. `value(plan)` renders the
// cell; `enforced` drives the honest "Live / Soon" badge.
export interface FeatureRow {
  key:      string;
  label:    string;
  enforced: boolean;
  value:    (p: PlanId) => string | boolean;
}

export const FEATURE_ROWS: FeatureRow[] = [
  {
    key: 'assets', label: 'Assets (Pi domains / NFTs)', enforced: true,
    value: p => ENTITLEMENTS[p].assetLimit === Infinity ? 'Unlimited' : `Up to ${ENTITLEMENTS[p].assetLimit}`,
  },
  { key: 'support', label: 'Support', enforced: false,
    value: p => ({ community: 'Community', priority: 'Priority', dedicated: 'Dedicated' })[ENTITLEMENTS[p].supportTier] },
  { key: 'analytics',    label: 'Analytics dashboard',   enforced: false, value: p => ENTITLEMENTS[p].analyticsDashboard },
  { key: 'commerce',     label: 'Commerce store',        enforced: false, value: p => ENTITLEMENTS[p].commerceStore },
  { key: 'apiAccess',    label: 'API access',            enforced: false, value: p => ENTITLEMENTS[p].apiAccess },
  { key: 'customDomain', label: 'Custom domain',         enforced: false, value: p => ENTITLEMENTS[p].customDomain },
  { key: 'whiteLabel',   label: 'White-label options',   enforced: false, value: p => ENTITLEMENTS[p].whiteLabel },
];

/** Normalize any backend/casing variant to a known PlanId (defaults to FREE). */
export function normalizePlan(raw: unknown): PlanId {
  const s = String(raw ?? '').trim().toUpperCase();
  return s === 'PRO' || s === 'ENTERPRISE' ? s : 'FREE';
}

export function entitlementsFor(plan: unknown): Entitlements {
  return ENTITLEMENTS[normalizePlan(plan)];
}
