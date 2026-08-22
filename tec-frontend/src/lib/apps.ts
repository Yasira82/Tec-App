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
 * edit the registry; both surfaces follow.
 */
import { ALL_DOMAINS } from '@/domains/_registry';
import type { DomainGroup, Localized } from '@/domains/_types';

export interface EcosystemApp {
  slug:   string;
  name:   Localized;
  emoji:  string;
  /** The host that actually serves the app TODAY. */
  host:   string;
  group:  DomainGroup;
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
    slug:  d.slug,
    name:  d.name,
    emoji: d.emoji,
    host:  hostOf(d.route, d.slug),
    group: d.group,
    live:  d.status === 'live',
    blurb: d.valueProp ?? d.description,
  }));

export const GROUP_LABEL: Record<DomainGroup, Localized> = {
  platform:     { en: 'Platform',   ar: 'المنصة'   },
  finance:      { en: 'Finance',    ar: 'المال'    },
  commerce:     { en: 'Commerce',   ar: 'التجارة'  },
  social:       { en: 'Social',     ar: 'اجتماعي'  },
  real_world:   { en: 'Real World', ar: 'الواقع'   },
  tech:         { en: 'Tech',       ar: 'التقنية'  },
  monetization: { en: 'Premium',    ar: 'بريميوم'  },
};

/** One colour per group — the card's accent, its chip, and its icon tint. */
export const GROUP_COLOR: Record<DomainGroup, string> = {
  platform:     '#FBBF24',
  finance:      '#22C55E',
  commerce:     '#3B82F6',
  social:       '#8B5CF6',
  real_world:   '#F0A868',
  tech:         '#06B6D4',
  monetization: '#E8E0D0',
};

/** Filter chips, in registry order, each with its live count. */
export const GROUPS: { key: DomainGroup; count: number }[] =
  (Object.keys(GROUP_LABEL) as DomainGroup[])
    .map(key => ({ key, count: APPS.filter(a => a.group === key).length }))
    .filter(g => g.count > 0);
