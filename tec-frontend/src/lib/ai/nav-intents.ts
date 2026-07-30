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
    acc[d.slug] = { slug: d.slug, href: d.route, name: d.name };
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
  'tec:pay':           { href: '/hub?pay=1',                   name: { en: 'Open payment',      ar: 'افتح الدفع' } },
  'tec:send':          { href: '/dashboard/wallet?action=send',    name: { en: 'Send Pi',       ar: 'ابعت Pi' } },
  'tec:receive':       { href: '/dashboard/wallet?action=receive', name: { en: 'Receive Pi',    ar: 'استقبل Pi' } },
  'tec:wallet':        { href: '/dashboard/wallet',            name: { en: 'Open wallet',       ar: 'افتح المحفظة' } },
  'tec:kyc':           { href: '/hub/kyc',                     name: { en: 'Verify identity',   ar: 'وثّق هويتك' } },
  'tec:subscribe':     { href: '/hub/subscription',            name: { en: 'View plans',        ar: 'شوف الباقات' } },
  'tec:referral':      { href: '/hub/referral',                name: { en: 'Invite & Earn',     ar: 'ادعُ واكسب' } },
  'tec:notifications': { href: '/hub/notifications',           name: { en: 'Notifications',     ar: 'الإشعارات' } },
};

// [[go:slug]] · [[go:slug:action]] · with an optional |Label. Lowercase slug/action.
const MARKER = /\[\[go:([a-z0-9-]+)(?::([a-z0-9-]+))?(?:\|([^\]]+))?\]\]/gi;

export interface ParsedReply {
  /** The prose with all markers removed and trailing whitespace trimmed. */
  clean: string;
  /** Resolved intents, de-duplicated, unknown slugs/actions dropped. */
  intents: NavIntent[];
}

/**
 * Split a raw assistant reply into display prose + resolved navigation intents.
 * Unknown slugs/actions are silently dropped (the AI cannot invent a destination).
 */
export function parseNavIntents(raw: string): ParsedReply {
  const intents: NavIntent[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  MARKER.lastIndex = 0;
  while ((match = MARKER.exec(raw)) !== null) {
    const slug   = match[1].toLowerCase();
    const action = match[2]?.toLowerCase();
    const label  = match[3]?.trim();

    // An action marker MUST resolve to a known action target — never fall back to
    // the app home, or the AI could silently point somewhere it didn't mean.
    let base: NavTarget | undefined;
    if (action) {
      const at = ACTION_TARGETS[`${slug}:${action}`];
      if (at) base = { slug, href: at.href, name: at.name };
    } else {
      base = NAV_TARGETS[slug];
    }
    if (!base) continue;

    const key = action ? `${slug}:${action}` : slug;
    if (seen.has(key)) continue;
    seen.add(key);
    intents.push({ ...base, action, label: label || undefined });
  }

  const clean = raw.replace(MARKER, '').replace(/[ \t]+\n/g, '\n').trim();
  return { clean, intents };
}
