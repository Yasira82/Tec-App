// ══════════════════════════════════════════════════════════════
//  TEC DOMAIN TYPES v5 — PiRC-Aligned Federated Platform
// ══════════════════════════════════════════════════════════════

export type Locale = 'en' | 'ar';

export interface Localized {
  en: string;
  ar?: string;
}

export const t = (loc: Localized, lang: Locale = 'en'): string =>
  lang === 'ar' && loc.ar ? loc.ar : loc.en;

export type DomainStatus = 'live' | 'beta' | 'coming_soon' | 'maintenance';

export type DomainLayer =
  | 'os'
  | 'connector'
  | 'core'
  | 'domain'
  | 'meta';

export type DomainGroup =
  | 'finance'
  | 'commerce'
  | 'social'
  | 'real_world'
  | 'tech'
  | 'monetization'
  | 'platform';

export type Capability =
  | 'payments'
  | 'wallet'
  | 'kyc'
  | 'identity'
  | 'auth'
  | 'realtime'
  | 'notifications'
  | 'analytics'
  | 'assets'
  | 'commerce'
  | 'ai'
  | 'reputation'
  | 'governance';

export type ScopeAction = 'read' | 'write' | 'manage' | 'admin';
export type Scope = `${string}:${ScopeAction}`;

export interface DomainFeatures {
  hasNotifications: boolean;
  hasAnalytics:     boolean;
  requiresKYC:      boolean;
  requiresPro:      boolean;
}

export type PaymentMode = 'pi-platform' | 'pirc2' | 'pirc1' | 'none';

export type BFFName = `${string}-bff`;

export interface DomainAPI {
  bff:          BFFName;
  gateway?:     string;
  // ✅ P4 FIX: required — no more runtime ambiguity
  paymentMode:  PaymentMode;
}

export interface DomainSDK {
  scopes: Scope[];
}

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired';

export type BillingInterval =
  | { kind: 'fixed-secs';    secs: number }
  | { kind: 'calendar-month'              }
  | { kind: 'calendar-year'               }
  | { kind: 'lifetime'                    };

export const intervalToPeriodSecs = (i: BillingInterval): number | undefined => {
  switch (i.kind) {
    case 'fixed-secs':     return i.secs;
    case 'calendar-month': return 30  * 24 * 3600;
    case 'calendar-year':  return 365 * 24 * 3600;
    case 'lifetime':       return undefined;
  }
};

export interface DomainTier {
  slug:              string;
  name:              Localized;
  rank:              number;
  price?: {
    amount:   number;
    currency: 'PI' | 'USD';
  };
  benefits?:         Localized[];
  billingInterval?:  BillingInterval;
  trialPeriodSecs?:  number;
  approvePeriods?:   number;
  onChainServiceId?: number;
}

export interface DomainOwnership {
  team?:    string;
  contact?: string;
}

export interface PaymentsRouter {
  pay?(args: { amount: number; currency: 'PI'; memo?: string }): Promise<{ txId: string }>;
  subscribe?(args: { tierSlug: string; payUpfront: boolean }): Promise<{ subId: bigint }>;
  cancel?(args: { subId: bigint }): Promise<void>;
  stake?(args: { launchId: string; amount: number }): Promise<{ commitment: bigint }>;
}

export interface DomainConfig {
  slug:              string;
  name:              Localized;
  piDomain:          string;
  emoji:             string;
  description:       Localized;
  /**
   * User-facing value proposition — the plain "why a Pioneer would use this"
   * line, distinct from the engineering-flavored `description`. Marketing SSoT
   * (KB C-133 R6: every app must state real standalone value). Rendered on
   * /pioneers and reusable as the Pi Portal listing copy. Optional so the
   * registry stays valid before every app is filled in; validated to be present
   * for LIVE apps in validateRegistry().
   */
  valueProp?:        Localized;
  status:            DomainStatus;
  layer:             DomainLayer;
  group:             DomainGroup;
  route:             string | null;
  features:          DomainFeatures;
  api:               DomainAPI;
  capabilities:      Capability[];
  dependsOnDomains?: string[];
  sdk?:              DomainSDK;
  tiers?:            DomainTier[];
  order:             number;
  children?:         string[];
  version?:          `v${number}`;
  ownership?:        DomainOwnership;
}
