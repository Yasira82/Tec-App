/**
 * The ecosystem list shown to a VISITOR (landing + /demo), derived from the ONE
 * registry the signed-in Hub already uses.
 *
 * This file used to hand-type all 24 apps — a second source of truth beside
 * `@/domains/_registry`, and it had drifted badly: the first page a user ever
 * sees showed Dx with a hospital icon under "HEALTH" (it is the developer
 * platform), Zone as "Digital Communities" (it is the verification runtime),
 * Legend as "Gamification" (it is the reputation runtime), a card literally
 * titled "Tec / Tec" for the platform itself, and 22 of 24 live apps with no
 * LIVE badge. None of that was a rendering bug — it was a copy that nobody
 * updated when the registry moved. P1/P2: define it once.
 *
 * Everything below is now COMPUTED. To change an icon, a name, or a status,
 * edit the registry; to change how an app is CLASSIFIED, edit
 * `@/domains/_categories` — the same taxonomy the Hub grid groups by.
 */
import { ALL_DOMAINS } from '@/domains/_registry';
import { CATEGORIES, categoryOf, accentOf, UNCLASSIFIED_ACCENT,
         type AppCategory } from '@/domains/_categories';
import type { Localized } from '@/domains/_types';

export interface EcosystemApp {
  slug:   string;
  name:   Localized;
  emoji:  string;
  /** The host that actually serves the app TODAY. */
  host:   string;
  /** The user-facing category — the SAME one the Hub groups its grid by. */
  category: AppCategory | undefined;
  accent: string;
  live:   boolean;
  /** The user-facing "why would I use this" line, not the engineering blurb. */
  blurb:  Localized;
}

/** `https://life.tecosystem.app/app` → `life.tecosystem.app` */
const hostOf = (route: string | null, slug: string): string => {
  if (route?.startsWith('http')) {
    try { return new URL(route).host; } catch { /* fall through */ }
  }
  return `${slug}.tecosystem.app`;
};

export const APPS: EcosystemApp[] = ALL_DOMAINS
  // The OS layer is the platform itself (Hub · Dashboard · AI), not a tile you
  // open — the Hub grid excludes it for the same reason.
  .filter(d => d.layer !== 'os')
  .map(d => ({
    slug:     d.slug,
    name:     d.name,
    emoji:    d.emoji,
    host:     hostOf(d.route, d.slug),
    category: categoryOf(d.slug),
    accent:   accentOf(d.slug),
    live:     d.status === 'live',
    blurb:    d.valueProp ?? d.description,
  }));

/** Filter chips, in taxonomy order, each with its count. An unclassified app
 *  falls into a visible "More" chip rather than disappearing. */
export const GROUPS: { key: AppCategory | 'other'; label: Localized; count: number }[] = [
  ...CATEGORIES.map(c => ({
    key:   c.key as AppCategory | 'other',
    label: c.label,
    count: APPS.filter(a => a.category === c.key).length,
  })),
  {
    key:   'other' as const,
    label: { en: 'More', ar: 'أخرى' },
    count: APPS.filter(a => !a.category).length,
  },
].filter(g => g.count > 0);

export const UNCLASSIFIED = UNCLASSIFIED_ACCENT;
