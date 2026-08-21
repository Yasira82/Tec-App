/**
 * TEC AI — Navigation Intents (V2 orchestration primitive).
 *
 * The assistant is a GUIDE, not an executor (C-104 v2.0 §1.5 — Decision-Support,
 * C-47 P6). A "navigation intent" is the smallest orchestration step: the model
 * reasons about what the user wants, then points to the EXACT app/page — or the
 * EXACT action inside the Hub — it never moves Pi or completes the action itself.
 *
 * Transport: the model appends a marker in the reply, which we parse out of the
 * streamed text, strip from the prose, and render as an action chip:
 *   [[go:<slug>]]                 → open an app         (e.g. [[go:commerce]])
 *   [[go:<slug>:<action>]]        → a specific action   (e.g. [[go:tec:pay]])
 *   [[go:<slug>|Custom label]]    → override the label
 *   [[go:<slug>:<action>|Label]]
 * Works across all three providers (Claude/Groq/Gemini) with no per-provider
 * tool-calling schema.
 *
 * App targets are DERIVED from the domain registry (single source of truth, P1);
 * action targets are the Hub's own deep-links. An unknown slug/action is dropped
 * (fail closed), so the AI can never route a user to a fabricated destination.
 */
import { DOMAIN_REGISTRY } from '@/domains/_registry';
import type { Localized }  from '@/domains/_types';

export interface NavTarget {
  slug: string;
  href: string;
  name: Localized;
  /** The app's registry emoji — a chip reading "تك ←" is not a call to action. */
  emoji?: string;
}

export interface NavIntent extends NavTarget {
  /** The specific in-app action, when the marker named one (e.g. 'pay'). */
  action?: string;
  /** Optional label the model supplied after the pipe; falls back to the name. */
  label?: string;
}

/** slug → { href, name } for every LIVE app, built once from the registry. */
export const NAV_TARGETS: Record<string, NavTarget> = Object.values(DOMAIN_REGISTRY).reduce(
  (acc, d) => {
    if (d.status !== 'live' || !d.route) return acc;
    acc[d.slug] = { slug: d.slug, href: d.route, name: d.name, emoji: d.emoji };
    return acc;
  },
  {} as Record<string, NavTarget>,
);

/**
 * Hub deep-link actions, keyed `tec:<action>`. These are the concrete flows the
 * assistant can point a user straight to (all internal Hub paths — the wallet/KYC/
 * subscription/referral surfaces already exist). Pointers only — never execution.
 */
export const ACTION_TARGETS: Record<string, { href: string; name: Localized }> = {
  'tec:pay':           { href: '/hub?pay=1',                       name: { en: 'Open payment',      ar: 'افتح الدفع' } },
  'tec:send':          { href: '/dashboard/wallet?action=send',    name: { en: 'Send Pi',           ar: 'ابعت Pi' } },
  'tec:receive':       { href: '/dashboard/wallet?action=receive', name: { en: 'Receive Pi',        ar: 'استقبل Pi' } },
  'tec:wallet':        { href: '/dashboard/wallet',                name: { en: 'Open wallet',       ar: 'افتح المحفظة' } },
  'tec:kyc':           { href: '/hub/kyc',                         name: { en: 'Verify identity',   ar: 'وثّق هويتك' } },
  'tec:subscribe':     { href: '/hub/subscription',                name: { en: 'View plans',        ar: 'شوف الباقات' } },
  'tec:referral':      { href: '/hub/referral',                    name: { en: 'Invite & Earn',     ar: 'ادعُ واكسب' } },
  'tec:notifications': { href: '/hub/notifications',               name: { en: 'Notifications',     ar: 'الإشعارات' } },
  'tec:profile':       { href: '/hub/profile',                     name: { en: 'Your profile',      ar: 'ملفك الشخصي' } },
  'tec:analytics':     { href: '/hub/analytics',                   name: { en: 'Your analytics',    ar: 'تحليلاتك' } },
  'tec:orders':        { href: '/dashboard/orders',                name: { en: 'Your orders',       ar: 'طلباتك' } },
  'tec:assets':        { href: '/dashboard/assets',                name: { en: 'Your assets',       ar: 'أصولك' } },
  'tec:security':      { href: '/dashboard/security',              name: { en: 'Security',          ar: 'الأمان' } },
};

/**
 * Cross-app actions, keyed `<slug>:<action>`. Unlike the Hub actions above (Hub-relative
 * paths), these point to a SPECIFIC page INSIDE another live app. The `path` is appended
 * to the app's ORIGIN (derived from its registry route — SSoT), NOT to the registry
 * route itself: some apps live under a sub-path (`/app`, `/shop`) while their other pages
 * sit at the origin root (e.g. ecommerce `/orders`). Every path here is a real page in the
 * target app's repo — the AI can only reach a page that exists (fail closed). If the app
 * is not LIVE (absent from NAV_TARGETS), the action drops.
 */
export const APP_ACTIONS: Record<string, { path: string; name: Localized }> = {
  'ecommerce:shop':    { path: '/shop',         name: { en: 'Shop products',    ar: 'تسوّق المنتجات' } },
  'ecommerce:orders':  { path: '/orders',       name: { en: 'Your orders',      ar: 'طلباتك' } },
  'ecommerce:stores':  { path: '/store',        name: { en: 'Browse stores',    ar: 'تصفّح المتاجر' } },
  'ecommerce:sell':    { path: '/merchant',     name: { en: 'Sell (merchant)',  ar: 'بيع (تاجر)' } },
  'commerce:settings': { path: '/app/settings', name: { en: 'Store settings',   ar: 'إعدادات المتجر' } },
  // Nexus = the coordination runtime (C-109). These deep-link to a SPECIFIC governed
  // workflow so the assistant can recommend the right one for a multi-step goal.
  'nexus:workflows':    { path: '/app',                          name: { en: 'Nexus workflows',      ar: 'مسارات Nexus' } },
  'nexus:checkout':     { path: '/workflow/checkout-saga',       name: { en: 'Checkout saga',        ar: 'مسار الشراء (Checkout)' } },
  'nexus:asset':        { path: '/workflow/asset-transfer-saga', name: { en: 'Asset transfer saga',  ar: 'مسار نقل الأصول' } },
  'nexus:subscription': { path: '/workflow/subscription-renewal',name: { en: 'Subscription renewal', ar: 'مسار تجديد الاشتراك' } },
};

/** Origin of an absolute app route; '' for a relative (Hub) route. */
const originOf = (href: string): string => {
  try { return new URL(href).origin; } catch { return ''; }
};

/** An ordered, multi-step journey the assistant suggests across apps/actions. */
export interface NavFlow {
  steps: NavIntent[];
}

/**
 * Resolve a single step spec (slug, optional action, optional label) to an intent.
 * An action MUST resolve to a known action target — never fall back to the app
 * home, or the AI could silently point somewhere it didn't mean. Returns null when
 * the slug/action is unknown (fail closed).
 */
function resolveStep(slug: string, action?: string, label?: string): NavIntent | null {
  let base: NavTarget | undefined;
  if (action) {
    const hubAction = ACTION_TARGETS[`${slug}:${action}`];
    if (hubAction) {
      base = { slug, href: hubAction.href, name: hubAction.name };
    } else {
      // Cross-app action → the live app's origin + the action's real page path.
      const appAction = APP_ACTIONS[`${slug}:${action}`];
      const app       = NAV_TARGETS[slug];
      const origin    = app ? originOf(app.href) : '';
      if (appAction && origin) base = { slug, href: origin + appAction.path, name: appAction.name };
    }
  } else {
    base = NAV_TARGETS[slug];
  }
  if (!base) return null;
  return { ...base, action, label: label || undefined };
}

// [[go:slug]] · [[go:slug:action]] · with an optional |Label. Lowercase slug/action.
const MARKER = /\[\[go:([a-z0-9-]+)(?::([a-z0-9-]+))?(?:\|([^\]]+))?\]\]/gi;
// [[flow: step ; step ; … ]] — a multi-step journey. Steps split on ';' or '>'.
const FLOW_MARKER = /\[\[flow:([^\]]+)\]\]/gi;
const STEP_SPEC   = /^([a-z0-9-]+)(?::([a-z0-9-]+))?(?:\|(.+))?$/i;

export interface ParsedReply {
  /** The prose with all markers removed and trailing whitespace trimmed. */
  clean: string;
  /** Resolved single-step intents, de-duplicated, unknown slugs/actions dropped. */
  intents: NavIntent[];
  /** Resolved multi-step flows (each with ≥2 valid steps). */
  flows: NavFlow[];
}

/**
 * Split a raw assistant reply into display prose + resolved navigation intents
 * and multi-step flows. Unknown slugs/actions are silently dropped (the AI cannot
 * invent a destination).
 */
export function parseNavIntents(raw: string): ParsedReply {
  const intents: NavIntent[] = [];
  const flows:   NavFlow[]   = [];
  const seen = new Set<string>();

  // Multi-step flows first.
  let fm: RegExpExecArray | null;
  FLOW_MARKER.lastIndex = 0;
  while ((fm = FLOW_MARKER.exec(raw)) !== null) {
    const steps: NavIntent[] = [];
    for (const spec of fm[1].split(/[;>]/).map(s => s.trim()).filter(Boolean)) {
      const sm = STEP_SPEC.exec(spec);
      if (!sm) continue;
      const step = resolveStep(sm[1].toLowerCase(), sm[2]?.toLowerCase(), sm[3]?.trim());
      if (step) steps.push(step);
    }
    if (steps.length >= 2) flows.push({ steps });   // a 1-step "flow" is just an intent
  }

  // Single-step intents.
  let match: RegExpExecArray | null;
  MARKER.lastIndex = 0;
  while ((match = MARKER.exec(raw)) !== null) {
    const step = resolveStep(match[1].toLowerCase(), match[2]?.toLowerCase(), match[3]?.trim());
    if (!step) continue;
    const key = step.action ? `${step.slug}:${step.action}` : step.slug;
    if (seen.has(key)) continue;
    seen.add(key);
    intents.push(step);
  }

  const clean = raw.replace(FLOW_MARKER, '').replace(MARKER, '').replace(/[ \t]+\n/g, '\n').trim();
  return { clean, intents, flows };
}
