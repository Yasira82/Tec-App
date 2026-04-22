// ══════════════════════════════════════════════════════════════
//  TEC DOMAIN TYPES v5 — PiRC-Aligned Federated Platform
//  Source of truth for the shape of every domain in the registry
//
//  Changes vs v4:
//    • SubscriptionStatus: explicit 5-state machine (PiRC-2 lifecycle)
//    • BillingInterval: discriminated union (calendar-aware)
//    • DomainTier: extended with status, billingInterval, periodSecs derivation
//    • PaymentMode: declared at domain.api level (pirc1/pirc2/pi-platform)
//    • PaymentsRouter: skeleton interface for SDK execution layer
//    • Lifetime constraints: enforced via type-level discrimination
//
//  References:
//    • PiRC-1: https://github.com/PiNetwork/PiRC/tree/main/PiRC1 (Launchpad)
//    • PiRC-2: https://github.com/PiNetwork/PiRC/tree/main/PiRC2 (Subscriptions)
//    • ADR-007: TEC adopts PiRC as native protocol layer
// ══════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
// i18n primitives
// ════════════════════════════════════════════════════════════

export type Locale = 'en' | 'ar';

export interface Localized {
  en: string;
  ar?: string;
}

/**
 * Translation helper — pure, side-effect-free.
 * Falls back to English when the requested locale is missing.
 */
export const t = (loc: Localized, lang: Locale = 'en'): string =>
  lang === 'ar' && loc.ar ? loc.ar : loc.en;

// ════════════════════════════════════════════════════════════
// Status & Layering
// ════════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════════
// Capabilities
// ════════════════════════════════════════════════════════════

/**
 * Logical capabilities a domain consumes.
 * NOT service names — abstract contracts the SDK fulfills.
 *
 * @stable Adding requires a minor SDK version bump.
 */
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

// ════════════════════════════════════════════════════════════
// Scope (declarative permission contract)
// ════════════════════════════════════════════════════════════

export type ScopeAction = 'read' | 'write' | 'manage' | 'admin';
export type Scope = `${string}:${ScopeAction}`;

// ════════════════════════════════════════════════════════════
// Feature flags
// ════════════════════════════════════════════════════════════

export interface DomainFeatures {
  hasNotifications: boolean;
  hasAnalytics:     boolean;
  requiresKYC:      boolean;
  requiresPro:      boolean;
}

// ════════════════════════════════════════════════════════════
// Payment integration mode (Pi protocol declaration)
// ════════════════════════════════════════════════════════════

/**
 * Which Pi protocol this domain uses for payments.
 *
 * • 'pi-platform' — Standard Pi Platform Payment API (one-shot payments).
 * • 'pirc2'       — PiRC-2 Soroban subscription contract (recurring).
 * • 'pirc1'       — PiRC-1 Launchpad (token sales / TGE).
 * • 'none'        — Domain has no monetary flow.
 */
export type PaymentMode = 'pi-platform' | 'pirc2' | 'pirc1' | 'none';

// ════════════════════════════════════════════════════════════
// API surface (BFF pattern)
// ════════════════════════════════════════════════════════════

export type BFFName = `${string}-bff`;

/**
 * Every domain exposes itself through a BFF (Backend-For-Frontend).
 * Architecture flow:  Domain → BFF → SDK → Services
 *
 * The frontend NEVER calls services or smart contracts directly.
 * All payment protocol routing happens via @tec/pi-protocols (PaymentsRouter).
 */
export interface DomainAPI {
  bff: BFFName;
  /** Optional API gateway in front of the BFF (for multi-region / edge). */
  gateway?: string;
  /** Which Pi payment protocol this domain uses. Defaults to 'none'. */
  paymentMode?: PaymentMode;
}

// ════════════════════════════════════════════════════════════
// SDK integration
// ════════════════════════════════════════════════════════════

export interface DomainSDK {
  scopes: Scope[];
}

// ════════════════════════════════════════════════════════════
// PiRC-2 Subscription State Machine
// ════════════════════════════════════════════════════════════

/**
 * Explicit subscription lifecycle states (off-chain projection of PiRC-2).
 *
 * State flow:
 *   trialing  ──(trial ends + first charge ok)──► active
 *   trialing  ──(trial ends + first charge fails)──► past_due
 *   active    ──(charge fails)──► past_due
 *   past_due  ──(retry succeeds)──► active
 *   past_due  ──(grace period elapses)──► canceled
 *   active    ──(user cancels)──► canceled  (remains usable until service_end_ts)
 *   any       ──(service_end_ts passes)──► expired
 *
 * The on-chain contract is the source of truth; this enum is the
 * off-chain projection used by UI, analytics, and alerting.
 */
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired';

// ════════════════════════════════════════════════════════════
// Billing Interval (calendar-aware, discriminated union)
// ════════════════════════════════════════════════════════════

/**
 * Billing interval semantics — separates time semantics from execution.
 *
 * Architecture rationale:
 *   • PiRC-2 contract operates on `period_secs: u64` (deterministic seconds).
 *   • Product UX expects calendar-aware billing (e.g. "monthly on the 15th").
 *   • Mapping a calendar interval to fixed seconds creates silent drift
 *     (e.g. "month" = 30 days ≠ Feb 28 ≠ Mar 31).
 *
 * Resolution:
 *   • `fixed-secs`        → executes natively on PiRC-2.
 *   • `calendar-month`    → BFF scheduler calls process() on calendar boundary.
 *   • `calendar-year`     → same, yearly cadence.
 *   • `lifetime`          → no recurring charge, no scheduler, no approval.
 */
export type BillingInterval =
  | { kind: 'fixed-secs';     secs: number }   // executes natively on-chain
  | { kind: 'calendar-month'                }  // off-chain scheduler
  | { kind: 'calendar-year'                 }  // off-chain scheduler
  | { kind: 'lifetime'                      }; // no recurring charge

/**
 * Helper: derive the equivalent `period_secs` for the on-chain contract.
 * Returns `undefined` for lifetime (no period).
 *
 * For calendar intervals, returns a *nominal* seconds value used only as
 * a fallback / approximation. The actual scheduling is calendar-driven.
 */
export const intervalToPeriodSecs = (i: BillingInterval): number | undefined => {
  switch (i.kind) {
    case 'fixed-secs':     return i.secs;
    case 'calendar-month': return 30 * 24 * 3600;   // nominal — scheduler is authoritative
    case 'calendar-year':  return 365 * 24 * 3600;  // nominal — scheduler is authoritative
    case 'lifetime':       return undefined;
  }
};

// ════════════════════════════════════════════════════════════
// Tiers (preserves identity within consolidated domains)
// ════════════════════════════════════════════════════════════

/**
 * A tier inside a tiered domain (e.g. membership: VIP / Elite / Titan / Legend).
 *
 * Each tier preserves its branding, pricing, and benefits while sharing
 * implementation, BFF, and billing flow with sibling tiers.
 */
export interface DomainTier {
  /** Tier identifier (lowercase, used in URLs & analytics). */
  slug: string;
  name: Localized;
  /** Ordering rank — 1 = lowest tier, higher = better. */
  rank: number;

  /**
   * Pricing — must be present for non-free tiers.
   *
   * Constraints (validated at registry load):
   *   • If parent domain.api.paymentMode === 'pirc2', currency MUST be 'PI'.
   *   • If billingInterval.kind === 'lifetime', interval field is implicit lifetime.
   */
  price?: {
    amount:   number;
    currency: 'PI' | 'USD';
  };

  /** Headline benefits for UI display. */
  benefits?: Localized[];

  // ─── PiRC-2 Subscription fields ─────────────────────────

  /**
   * Billing interval — required for any tier with a price.
   * Determines whether the tier executes on-chain or via off-chain scheduler.
   */
  billingInterval?: BillingInterval;

  /**
   * Trial period in seconds (0 = no trial).
   * Maps to PiRC-2 Service.trial_period_secs.
   *
   * Constraint: MUST be 0 (or undefined) when billingInterval.kind === 'lifetime'.
   */
  trialPeriodSecs?: number;

  /**
   * Number of periods to pre-approve for auto-renewal.
   * Maps to PiRC-2 Service.approve_periods.
   *
   * Constraint: MUST be undefined when billingInterval.kind === 'lifetime'.
   */
  approvePeriods?: number;

  /**
   * Holds the on-chain service_id once the tier is registered with the
   * PiRC-2 contract. Populated post-deployment.
   */
  onChainServiceId?: number;
}

// ════════════════════════════════════════════════════════════
// Ownership (CODEOWNERS automation)
// ════════════════════════════════════════════════════════════

export interface DomainOwnership {
  team?:    string;
  contact?: string;
}

// ════════════════════════════════════════════════════════════
// PaymentsRouter (SDK execution layer — skeleton)
// ════════════════════════════════════════════════════════════

/**
 * PaymentsRouter — single entry point for all payment operations across
 * Pi protocols. Domains never touch a protocol implementation directly.
 *
 * Implementation lives in @tec/pi-protocols/payments/router.ts (next phase).
 * This interface declares the contract so domains can be type-checked
 * against it today.
 *
 * Routing rules:
 *   • paymentMode === 'pi-platform' → @tec/pi-protocols/pi-platform
 *   • paymentMode === 'pirc2'       → @tec/pi-protocols/pirc2
 *   • paymentMode === 'pirc1'       → @tec/pi-protocols/pirc1
 *   • paymentMode === 'none'        → throws PaymentNotSupportedError
 */
export interface PaymentsRouter {
  /** One-shot payment (Pi Platform API). */
  pay?(args: { amount: number; currency: 'PI'; memo?: string }): Promise<{ txId: string }>;

  /** Subscribe to a tier (PiRC-2). */
  subscribe?(args: {
    tierSlug:   string;
    payUpfront: boolean;
  }): Promise<{ subId: bigint }>;

  /** Cancel a subscription (PiRC-2). */
  cancel?(args: { subId: bigint }): Promise<void>;

  /** Stake into a launchpad (PiRC-1). */
  stake?(args: { launchId: string; amount: number }): Promise<{ commitment: bigint }>;
}

// ════════════════════════════════════════════════════════════
// The contract
// ════════════════════════════════════════════════════════════

export interface DomainConfig {
  // ─── Identity ───────────────────────────────────────────
  slug:        string;
  name:        Localized;
  /**
   * Public domain on the Pi network.
   * Kept configurable (NOT derived from slug) for multi-surface scenarios.
   */
  piDomain:    string;
  emoji:       string;
  description: Localized;

  // ─── Classification ─────────────────────────────────────
  status: DomainStatus;
  layer:  DomainLayer;
  group:  DomainGroup;

  // ─── Routing ────────────────────────────────────────────
  route: string | null;

  // ─── Behavior ───────────────────────────────────────────
  features: DomainFeatures;

  // ─── API surface (BFF + payment protocol) ──────────────
  api: DomainAPI;

  // ─── What this domain NEEDS to function ─────────────────
  capabilities: Capability[];

  // ─── Domains this domain composes with ──────────────────
  dependsOnDomains?: string[];

  // ─── SDK scopes — declarative permission contract ───────
  sdk?: DomainSDK;

  // ─── Tiers — preserves identity in tiered products ──────
  tiers?: DomainTier[];

  // ─── Ordering & navigation ──────────────────────────────
  order: number;
  /**
   * UI sub-routes ONLY. For tiered products, prefer `tiers[]`.
   */
  children?: string[];

  // ─── Optional metadata ──────────────────────────────────
  version?:   `v${number}`;
  ownership?: DomainOwnership;
}
