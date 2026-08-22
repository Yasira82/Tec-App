/**
 * The landing page is the FIRST thing a visitor sees, and for months it showed a
 * different ecosystem than the Hub they were about to sign into:
 *
 *   · Dx wore a hospital icon under "HEALTH" — it is the developer platform
 *   · Zone read "Digital Communities" — it is the verification runtime (C-120)
 *   · Legend read "Gamification"      — it is the reputation runtime (C-126)
 *   · a card titled "Tec / Tec / tec.pi" for the platform itself
 *   · FundX / NBF / DX / NX / VIP printed as Fundx / Nbf / Dx / Nx / Vip
 *   · 22 of 23 live apps carried no LIVE badge
 *   · every card advertised `<app>.pi`, an address that does not resolve yet
 *
 * None of it was a rendering bug. `src/lib/apps.ts` was a hand-typed COPY of the
 * registry that nobody updated, and the page's own test mocked the registry away
 * with empty arrays — so the copy could rot with every test green.
 *
 * These assertions are on the boundary itself: the visitor's list IS the Hub's
 * list. A future edit that reintroduces a second source fails here.
 */
import { describe, it, expect } from 'vitest';
import { APPS, GROUPS, GROUP_COLOR, GROUP_LABEL } from '@/lib/apps';
import { ALL_DOMAINS, LIVE_DOMAINS } from '@/domains/_registry';

const openable = ALL_DOMAINS.filter(d => d.layer !== 'os');

describe('landing ecosystem list ⟺ domain registry', () => {
  it('shows exactly the apps the Hub shows', () => {
    expect(APPS.map(a => a.slug)).toEqual(openable.map(d => d.slug));
  });

  it('uses the registry icon for every app — the visitor must recognise it after login', () => {
    for (const app of APPS) {
      const domain = ALL_DOMAINS.find(d => d.slug === app.slug)!;
      expect(app.emoji).toBe(domain.emoji);
    }
  });

  it('uses the registry name, including its casing', () => {
    for (const app of APPS) {
      const domain = ALL_DOMAINS.find(d => d.slug === app.slug)!;
      expect(app.name.en).toBe(domain.name.en);
    }
  });

  it('uses the registry group — a filter cannot classify an app the Hub disagrees with', () => {
    for (const app of APPS) {
      const domain = ALL_DOMAINS.find(d => d.slug === app.slug)!;
      expect(app.group).toBe(domain.group);
    }
  });

  it('marks every live app LIVE, not just the two that were hand-listed', () => {
    const liveSlugs = LIVE_DOMAINS.filter(d => d.layer !== 'os').map(d => d.slug).sort();
    expect(APPS.filter(a => a.live).map(a => a.slug).sort()).toEqual(liveSlugs);
  });

  it('excludes the OS layer — TEC is the platform, not a tile inside it', () => {
    expect(APPS.some(a => a.slug === 'tec')).toBe(false);
  });
});

describe('what the visitor is told is true today', () => {
  it('advertises a host that serves the app now, never a .pi address', () => {
    for (const app of APPS) {
      expect(app.host).not.toMatch(/\.pi$/);
      expect(app.host).toContain('.');
    }
  });

  it('prefers the value proposition over the engineering blurb', () => {
    // `description` is written for engineers ("Coordination Runtime — Workflows ·
    // Routing · Sagas"). A visitor gets `valueProp` wherever one exists.
    for (const app of APPS) {
      const domain = ALL_DOMAINS.find(d => d.slug === app.slug)!;
      expect(app.blurb.en).toBe((domain.valueProp ?? domain.description).en);
    }
    expect(APPS.every(a => a.blurb.en.length > 0)).toBe(true);
  });
});

describe('group presentation', () => {
  it('every group in use has a label and a colour', () => {
    for (const app of APPS) {
      expect(GROUP_LABEL[app.group]?.en).toBeTruthy();
      expect(GROUP_COLOR[app.group]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('group colours are distinct, so a chip means one thing', () => {
    const used = [...new Set(APPS.map(a => a.group))].map(g => GROUP_COLOR[g]);
    expect(new Set(used).size).toBe(used.length);
  });

  it('chip counts add up to the full list', () => {
    expect(GROUPS.reduce((n, g) => n + g.count, 0)).toBe(APPS.length);
  });

  it('no chip is empty — an empty filter is a dead control', () => {
    for (const g of GROUPS) expect(g.count).toBeGreaterThan(0);
  });
});
