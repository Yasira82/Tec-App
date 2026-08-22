/**
 * The USER-FACING app taxonomy — one classification, every surface.
 *
 * The registry carries a `group` field, but it is a coarse ENGINEERING label and
 * it disagrees with how the platform actually presents itself: it files Zone under
 * "social" when Zone is the Verification Runtime (C-120), Analytics and System
 * under "tech" alongside the developer tools, and VIP/Elite/Legend under
 * "monetization" when they are the reputation chain (C-126 → C-127 → C-128).
 *
 * This map is the taxonomy grounded in the Economic OS Model (C-119) and the app
 * charters (C-105→C-131). It lived inside `HubAppsGrid` with a comment saying not
 * to use the registry's `group` — and then the landing page was rebuilt on the
 * registry's `group` anyway, so the two surfaces classified 17 of 23 apps
 * differently. A rule written in one component's comment is not a rule; it is a
 * note. It lives here now, and `app-taxonomy.test.ts` holds both surfaces to it.
 */
import type { Localized } from './_types';
import type { IconName }  from '@/components/ui/Icon';

export type AppCategory =
  | 'money'
  | 'work'
  | 'realworld'
  | 'social'
  | 'reputation'
  | 'trust';

/** Every non-OS app appears exactly once. Enforced by the taxonomy test. */
export const CATEGORY_OF: Record<string, AppCategory> = {
  // Money & Commerce — trade, ownership, capital, protection
  commerce: 'money', ecommerce: 'money', assets: 'money', fundx: 'money', insure: 'money',
  // Business & Work — build, enterprise, opportunities, developers
  nbf: 'work', titan: 'work', nx: 'work', epic: 'work', dx: 'work',
  // Real World — property, institutional assets, discovery
  estate: 'realworld', brookfield: 'realworld', explorer: 'realworld',
  // Identity & Social — personal + relationships
  life: 'social', connection: 'social',
  // Reputation — evidence → recognition → premium (C-126 → C-127 → C-128)
  legend: 'reputation', elite: 'reputation', vip: 'reputation',
  // Trust & Intelligence — verification, governance, data, coordination
  zone: 'trust', system: 'trust', analytics: 'trust', alert: 'trust', nexus: 'trust',
};

/**
 * The launcher glyph for each app — one picture per app, everywhere it appears.
 *
 * The registry's `emoji` is kept (marketing copy, the AI's nav chips, plain-text
 * contexts) but it is NOT what the launcher draws any more. Two reasons:
 *
 *  1. It was not one picture per app. 🧭 was BOTH Nexus and Explorer; 🛡️ was BOTH
 *     Zone and Insure. Two tiles with the identical glyph in a 23-tile grid is a
 *     wrong answer to "which one is which", not a style preference.
 *  2. It was not one style. The platform emoji font draws 👑 🎖️ 🔔 as glossy 3D
 *     objects and 🔗 ⚖️ 🛠️ 🏛️ as flat grey line art, so neighbouring tiles looked
 *     like they came from different products — and it changes per device, so
 *     there was no fixing it in CSS.
 *
 * These are stroke glyphs on the shared 24×24 grid (see `Icon.tsx`), tinted with
 * the category accent, so a section reads as one family.
 */
export const ICON_OF: Record<string, IconName> = {
  // Money & Commerce
  commerce: 'cart', ecommerce: 'store', assets: 'gem', fundx: 'trending', insure: 'shield',
  // Business & Work
  nbf: 'briefcase', titan: 'landmark', nx: 'target', epic: 'rocket', dx: 'code',
  // Real World
  estate: 'home', brookfield: 'towers', explorer: 'search',
  // Identity & Social
  life: 'sprout', connection: 'link',
  // Reputation — evidence → recognition → privilege, and visibly three things
  legend: 'trophy', elite: 'award', vip: 'crown',
  // Trust & Intelligence
  zone: 'shieldCheck', system: 'scale', analytics: 'chart', alert: 'bell', nexus: 'network',
};

/** Fallback for an app added to the registry before it is given a glyph. */
export const UNCLASSIFIED_ICON: IconName = 'box';

export const iconOf = (slug: string): IconName => ICON_OF[slug] ?? UNCLASSIFIED_ICON;

export interface CategoryMeta {
  key:    AppCategory;
  label:  Localized;
  /** One harmonised accent per category (EVL palette, C-83), so a section reads as
   *  a colour family instead of 23 unrelated tile colours. */
  accent: string;
}

/** Display order. Money first: it is why most people arrive. */
export const CATEGORIES: CategoryMeta[] = [
  { key: 'money',      label: { en: 'Money & Commerce',     ar: 'المال والتجارة'   }, accent: '#FBBF24' },
  { key: 'work',       label: { en: 'Business & Work',      ar: 'الأعمال والعمل'   }, accent: '#3B82F6' },
  { key: 'realworld',  label: { en: 'Real World',           ar: 'العالم الواقعي'   }, accent: '#22C55E' },
  { key: 'social',     label: { en: 'Identity & Social',    ar: 'الهوية والتواصل'  }, accent: '#8B5CF6' },
  { key: 'reputation', label: { en: 'Reputation',           ar: 'السمعة'           }, accent: '#EC4899' },
  { key: 'trust',      label: { en: 'Trust & Intelligence', ar: 'الثقة والمعلومات' }, accent: '#06B6D4' },
];

/** Fallback for an app added to the registry but not yet classified here. Visible
 *  on purpose — a grey tile in a "More" section is a prompt to classify it, not a
 *  silent default that looks intentional. */
export const UNCLASSIFIED_ACCENT = '#94A3B8';

const META = new Map(CATEGORIES.map(c => [c.key, c]));

export const categoryOf  = (slug: string): AppCategory | undefined => CATEGORY_OF[slug];
export const categoryMeta = (key: AppCategory): CategoryMeta | undefined => META.get(key);
export const accentOf    = (slug: string): string =>
  META.get(CATEGORY_OF[slug])?.accent ?? UNCLASSIFIED_ACCENT;
