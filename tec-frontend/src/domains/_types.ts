// ══════════════════════════════════════════════════════════════
//  TEC DOMAIN TYPES v4 — Federated Platform Edition
//  Source of truth for the shape of every domain in the registry
//
//  Changes vs v3:
//    • i18n: name & description are now Localized<string>
//    • Tiers: first-class concept (preserves identity within consolidation)
//    • Scope: strict template-literal type (resource:action)
//    • Capabilities: added 'ai', 'reputation', 'governance'
//    • Ownership: optional team/contact field for CODEOWNERS automation
//    • Version: optional v1/v2 marker for rolling migrations
//    • BFFName: template-literal type catches typos at compile time
// ══════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
// i18n primitives
// ════════════════════════════════════════════════════════════

/**
 * Supported UI locales.
 * Add new locales here as the platform expands (fr, es, hi, zh...).
 */
export type Locale = 'en' | 'ar';

/**
 * Localized string. English is required (default fallback).
 * Arabic is optional — UI falls back to `en` when `ar` is missing.
 */
export interface Localized {
  en: string;
  ar?: string;
}

/**
 * Translation helper — pure, side-effect-free.
 * Falls back to English when the requested locale is missing.
 *
 * @example
 *   t({ en: 'Hello', ar: 'مرحبا' }, 'ar') // → 'مرحبا'
 *   t({ en: 'Hello' },              'ar') // → 'Hello' (fallback)
 */
export const t = (loc: Localized, lang: Locale = 'en'): string =>
  lang === 'ar' && loc.ar ? loc.ar : loc.en;

// ════════════════════════════════════════════════════════════
// Status & Layering
// ════════════════════════════════════════════════════════════

export type DomainStatus = 'live' | 'beta' | 'coming_soon' | 'maintenance';

export type DomainLayer =
  | 'os'         // TEC Control Plane
  | 'connector'  // Nexus — Identity + Routing
  | 'core'       // Core Capabilities (Assets, Commerce, AI, Trust)
  | 'domain'     // Domain Apps
  | 'meta';      // System / Alert / Analytics — cross-cutting

export type DomainGroup =
  | 'finance'
  | 'commerce'
  | 'social'
  | 'real_world'
  | 'tech'
  | 'monetization'  // VIP / Elite / Titan / Legend tiers + Epic
  | 'platform';     // OS + Connector + Core + Meta

// ════════════════════════════════════════════════════════════
// Capabilities (semantic, not service-bound)
// ════════════════════════════════════════════════════════════

/**
 * Logical capabilities a domain consumes.
 * NOT service names — these are abstract contracts the SDK fulfills.
 *
 * Domain → declares capabilities → SDK routes to the right service(s).
 * Swapping a service implementation does NOT break domains.
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
  | 'ai'           // 🆕 AI agent / inference / automation
  | 'reputation'   // 🆕 Trust scores / attestations (provided by `trust`)
  | 'governance';  // 🆕 Voting / proposals / DAO mechanics

// ════════════════════════════════════════════════════════════
// Scope (declarative permission contract)
// ════════════════════════════════════════════════════════════

/** Standard CRUD-like actions a scope can grant. */
export type ScopeAction = 'read' | 'write' | 'manage' | 'admin';

/**
 * Scope format: `{resource}:{action}` — e.g. `payments:read`, `wallet:write`.
 *
 * Resources can be:
 *   • Capabilities (e.g. `payments:read`, `wallet:write`)
 *   • Domain-specific nouns (e.g. `subscriptions:manage`, `proposals:write`)
 *
 * Enforced by TEC-SDK at request time — a domain asking for a scope
 * it didn't declare here will be rejected (defense-in-depth).
 */
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
// API surface (BFF pattern)
// ════════════════════════════════════════════════════════════

/**
 * BFF name follows the pattern `{slug}-bff`.
 * Type-safe via template literal — typos caught at compile time.
 */
export type BFFName = `${string}-bff`;

/**
 * Every domain exposes itself through a BFF (Backend-For-Frontend).
 * The BFF is the single entry point — it composes calls to multiple
 * backend services internally. The frontend NEVER calls services directly.
 *
 * Architecture flow:  Domain → BFF → SDK → Services
 */
export interface DomainAPI {
  bff: BFFName;
  /** Optional API gateway in front of the BFF (for multi-region / edge). */
  gateway?: string;
}

// ════════════════════════════════════════════════════════════
// SDK integration
// ════════════════════════════════════════════════════════════

/**
 * SDK scopes the domain is allowed to use at runtime.
 */
export interface DomainSDK {
  scopes: Scope[];
}

// ════════════════════════════════════════════════════════════
// Tiers (preserves identity within consolidated domains)
// ════════════════════════════════════════════════════════════

/**
 * A tier inside a tiered domain (e.g. membership: VIP / Elite / Titan / Legend).
 *
 * Why tiers exist as first-class objects:
 *   • Each tier keeps its branding, name, pricing, and benefits.
 *   • Implementation, BFF, and billing flow stay unified.
 *   • Marketing pages, comparison tables, and upgrade flows
 *     can be auto-generated from this data.
 *
 * Rule: use `tiers[]` for tiered/subscription products.
 *       use `children[]` for UI sub-routes.
 */
export interface DomainTier {
  /** Tier identifier (lowercase, used in URLs & analytics). */
  slug: string;
  name: Localized;
  /** Ordering rank — 1 = lowest tier, higher = better. */
  rank: number;
  /** Optional pricing — omit if tier is free or custom-quoted. */
  price?: {
    amount:    number;
    currency:  'PI' | 'USD';
    interval?: 'month' | 'year' | 'lifetime';
  };
  /** Headline benefits for UI display. */
  benefits?: Localized[];
}

// ════════════════════════════════════════════════════════════
// Ownership (CODEOWNERS automation)
// ════════════════════════════════════════════════════════════

/**
 * Who owns this domain operationally.
 * Used to auto-generate CODEOWNERS in monorepo migrations
 * and to route alerts/incidents to the right team.
 */
export interface DomainOwnership {
  /** Team identifier (e.g. 'platform', 'finance', 'social'). */
  team?:    string;
  /** GitHub handle of the maintainer (e.g. '@yasser1728'). */
  contact?: string;
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
   * Kept configurable (NOT derived from slug) to allow per-domain overrides
   * like life.app, life.ai, etc. in future multi-surface scenarios.
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

  // ─── API surface (BFF — replaces 1:1 service coupling) ──
  api: DomainAPI;

  // ─── What this domain NEEDS to function ─────────────────
  capabilities: Capability[];

  // ─── Domains this domain composes with (graph edges) ────
  dependsOnDomains?: string[];

  // ─── SDK scopes — declarative permission contract ───────
  sdk?: DomainSDK;

  // ─── Tiers — preserves identity in tiered products ──────
  tiers?: DomainTier[];

  // ─── Ordering & navigation ──────────────────────────────
  order: number;
  /**
   * UI sub-routes ONLY — pages inside the domain shell.
   * NOT logical sub-domains. A logical sub-domain gets its own registry entry.
   * For tiered products, prefer `tiers[]` over `children[]`.
   */
  children?: string[];

  // ─── Optional metadata ──────────────────────────────────
  /** Semantic version — for rolling migrations (assets v1 + v2 in parallel). */
  version?: `v${number}`;
  /** Ownership — drives CODEOWNERS generation in monorepo migration. */
  ownership?: DomainOwnership;
}
