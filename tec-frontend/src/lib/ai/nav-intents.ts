/**
 * TEC AI — Navigation Intents (V2, first orchestration primitive).
 *
 * The assistant is a GUIDE, not an executor (C-104 v2.0 §1.5 — Decision-Support,
 * C-47 P6). A "navigation intent" is the smallest orchestration step: the model
 * reasons about what the user wants, then points to the EXACT app/page to open —
 * it never moves Pi or completes an action itself.
 *
 * Transport: the model appends a marker `[[go:<slug>]]` (optionally
 * `[[go:<slug>|Custom label>]]`) when it recommends one specific app. We parse it
 * out of the streamed text, strip it from the prose, and render an action chip.
 * This works across all three providers (Claude/Groq/Gemini) with no per-provider
 * tool-calling schema.
 *
 * Targets are DERIVED from the domain registry (single source of truth, P1) — a
 * slug the registry doesn't know is dropped (fail closed), so the AI can never
 * route a user to a fabricated destination.
 */
import { DOMAIN_REGISTRY } from '@/domains/_registry';
import type { Localized }  from '@/domains/_types';

export interface NavTarget {
  slug: string;
  href: string;
  name: Localized;
}

export interface NavIntent extends NavTarget {
  /** Optional label the model supplied after the pipe; falls back to the app name. */
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

// [[go:slug]] or [[go:slug|Label]] — slug is lowercase letters/digits/hyphen.
const MARKER = /\[\[go:([a-z0-9-]+)(?:\|([^\]]+))?\]\]/gi;

export interface ParsedReply {
  /** The prose with all markers removed and trailing whitespace trimmed. */
  clean: string;
  /** Resolved intents, de-duplicated by slug, unknown slugs dropped. */
  intents: NavIntent[];
}

/**
 * Split a raw assistant reply into display prose + resolved navigation intents.
 * Unknown slugs are silently dropped (the AI cannot invent a destination).
 */
export function parseNavIntents(raw: string): ParsedReply {
  const intents: NavIntent[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  MARKER.lastIndex = 0;
  while ((match = MARKER.exec(raw)) !== null) {
    const slug   = match[1].toLowerCase();
    const label  = match[2]?.trim();
    const target = NAV_TARGETS[slug];
    if (!target || seen.has(slug)) continue;
    seen.add(slug);
    intents.push({ ...target, label: label || undefined });
  }

  const clean = raw.replace(MARKER, '').replace(/[ \t]+\n/g, '\n').trim();
  return { clean, intents };
}
