/**
 * One picture per app, and one picture style.
 *
 * The launcher ran on the registry's `emoji`, which failed both halves:
 *   · 🧭 was BOTH Nexus and Explorer, 🛡️ was BOTH Zone and Insure — two tiles
 *     in the same 23-tile grid with the identical glyph;
 *   · the platform font draws 👑 🎖️ 🔔 as glossy 3D objects and 🔗 ⚖️ 🛠️ 🏛️ as
 *     flat grey line art, and which one you get depends on the device.
 *
 * These assertions hold the replacement to what emoji could not promise. They
 * run against the registry, so an app added tomorrow fails here rather than
 * shipping as a grey fallback box nobody notices.
 */
import { describe, it, expect } from 'vitest';
import { LIVE_DOMAINS, ALL_DOMAINS } from '@/domains/_registry';
import { ICON_OF, iconOf, UNCLASSIFIED_ICON } from '@/domains/_categories';
import { PATHS } from '@/components/ui/Icon';

/** Every app a user can actually see in a launcher (the OS layer is not one). */
const APPS = ALL_DOMAINS.filter(d => d.layer !== 'os');

describe('app icons', () => {
  it('gives every app a glyph — no silent fallback box', () => {
    const missing = APPS.filter(d => !ICON_OF[d.slug]).map(d => d.slug);
    expect(missing).toEqual([]);
  });

  it('gives every app its OWN glyph — this is what emoji got wrong', () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const d of APPS) {
      const icon = iconOf(d.slug);
      const first = seen.get(icon);
      if (first) clashes.push(`${icon}: ${first} + ${d.slug}`);
      else seen.set(icon, d.slug);
    }
    expect(clashes).toEqual([]);
  });

  it('points only at glyphs that exist in the icon set', () => {
    const unknown = Object.entries(ICON_OF)
      .filter(([, icon]) => !(icon in PATHS))
      .map(([slug, icon]) => `${slug} -> ${icon}`);
    expect(unknown).toEqual([]);
  });

  it('maps no slug the registry does not have', () => {
    const known = new Set(ALL_DOMAINS.map(d => d.slug));
    expect(Object.keys(ICON_OF).filter(s => !known.has(s))).toEqual([]);
  });

  it('falls back visibly rather than crashing on an unknown slug', () => {
    // A grey box in the grid is a prompt to classify the app; a thrown error
    // during render would take the whole launcher down (P6: degrade, loudly).
    expect(iconOf('not-a-real-app')).toBe(UNCLASSIFIED_ICON);
    expect(UNCLASSIFIED_ICON in PATHS).toBe(true);
  });

  it('covers every LIVE app — those are the tiles on screen today', () => {
    for (const d of LIVE_DOMAINS.filter(d => d.layer !== 'os')) {
      expect(iconOf(d.slug)).not.toBe(UNCLASSIFIED_ICON);
    }
  });
});

describe('the glyphs themselves', () => {
  it('are drawn on the shared 24x24 grid — no nested svg or its own viewBox', () => {
    // Every path string is raw SVG *children* of one <svg viewBox="0 0 24 24">.
    // A glyph that smuggles in its own <svg> would render at the wrong scale.
    // (`width`/`height` on a <rect> are geometry, not a canvas — those are fine.)
    for (const [name, d] of Object.entries(PATHS)) {
      expect(d, name).not.toMatch(/<svg|viewBox=/);
      expect(d.length, name).toBeGreaterThan(0);
    }
  });

  it('carry no baked-in colour — the tile tints them', () => {
    // A hardcoded fill/stroke would ignore the category accent and break the
    // "one colour family per section" reading.
    for (const [name, d] of Object.entries(PATHS)) {
      expect(d, name).not.toMatch(/fill="(?!none)|stroke="/);
    }
  });
});
