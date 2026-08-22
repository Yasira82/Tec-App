/**
 * ONE taxonomy, both surfaces.
 *
 * The Hub grid grouped apps by a map defined inside `HubAppsGrid`, carrying a
 * comment that said explicitly NOT to use the registry's coarse `group` field
 * because it mis-files Zone under "social" (Zone is the Verification Runtime,
 * C-120). The landing page was then rebuilt directly on `group` — and the two
 * surfaces ended up classifying **17 of 23 apps differently**: Zone was Social
 * before login and Trust & Intelligence after, Commerce was Platform before and
 * Money after, VIP/Elite/Legend were Premium before and Reputation after.
 *
 * A rule written in one component's comment is a note, not a rule. The taxonomy
 * now lives in `@/domains/_categories` and these assertions hold both consumers
 * to it — including the case that started all of this: Zone.
 */
import { describe, it, expect } from 'vitest';
import {
  CATEGORIES, CATEGORY_OF, categoryOf, accentOf,
  UNCLASSIFIED_ACCENT, type AppCategory,
} from '@/domains/_categories';
import { ALL_DOMAINS } from '@/domains/_registry';
import { APPS, GROUPS } from '@/lib/apps';

/** Every app that should be classified. The OS layer is the platform itself, not
 *  a tile, so both surfaces exclude it. Derived HERE rather than in the taxonomy
 *  module so that module stays free of a registry import — one existed briefly and
 *  broke every partial `vi.mock('@/domains/_registry')` in the suite. */
const CLASSIFIABLE_SLUGS = ALL_DOMAINS.filter(d => d.layer !== 'os').map(d => d.slug);

describe('the taxonomy covers the ecosystem', () => {
  it('classifies every app a visitor or a signed-in user can open', () => {
    const missing = CLASSIFIABLE_SLUGS.filter(slug => !CATEGORY_OF[slug]);
    expect(missing).toEqual([]);
  });

  it('classifies nothing that is not an app', () => {
    // A stale slug left behind after a rename would sit here unnoticed.
    const known = new Set(CLASSIFIABLE_SLUGS);
    expect(Object.keys(CATEGORY_OF).filter(s => !known.has(s))).toEqual([]);
  });

  it('files each app under exactly one category', () => {
    const seen = new Map<string, AppCategory[]>();
    for (const [slug, cat] of Object.entries(CATEGORY_OF)) {
      seen.set(slug, [...(seen.get(slug) ?? []), cat]);
    }
    for (const [slug, cats] of seen) expect(cats, slug).toHaveLength(1);
  });

  it('gives every category a distinct accent, so colour carries meaning', () => {
    const accents = CATEGORIES.map(c => c.accent);
    expect(new Set(accents).size).toBe(accents.length);
    expect(accents).not.toContain(UNCLASSIFIED_ACCENT);
  });

  it('labels every category in both languages — the landing is bilingual', () => {
    for (const c of CATEGORIES) {
      expect(c.label.en, c.key).toBeTruthy();
      expect(c.label.ar, c.key).toBeTruthy();
    }
  });
});

describe('the landing list follows the shared taxonomy, not the registry group', () => {
  it('gives every app the shared category', () => {
    for (const app of APPS) {
      expect(app.category, app.slug).toBe(categoryOf(app.slug));
    }
  });

  it('gives every app the shared accent', () => {
    for (const app of APPS) {
      expect(app.accent, app.slug).toBe(accentOf(app.slug));
    }
  });

  it('files Zone under Trust, never Social — it is the Verification Runtime', () => {
    // The exact disagreement that exposed the split classification.
    expect(APPS.find(a => a.slug === 'zone')?.category).toBe('trust');
  });

  it('keeps the reputation chain together — Legend, Elite and VIP', () => {
    for (const slug of ['legend', 'elite', 'vip']) {
      expect(APPS.find(a => a.slug === slug)?.category, slug).toBe('reputation');
    }
  });

  it('chip counts add up to every app, with none stranded', () => {
    expect(GROUPS.reduce((n, g) => n + g.count, 0)).toBe(APPS.length);
    for (const g of GROUPS) expect(g.count, String(g.key)).toBeGreaterThan(0);
  });

  it('has no "More" chip while everything is classified', () => {
    expect(GROUPS.some(g => g.key === 'other')).toBe(false);
  });
});
