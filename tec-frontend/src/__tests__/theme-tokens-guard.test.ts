/**
 * Light mode did not fail because the palette was wrong. It failed because the
 * components never asked the palette: they carried `rgba(255,255,255,0.82)` and
 * `#fff` inline, so the moment the page turned white every app label, every
 * eyebrow and every quick-action caption became white-on-white — invisible, with
 * no error anywhere to say so.
 *
 * A rendering test cannot catch that (jsdom resolves no custom properties and
 * paints nothing). The only guard that actually holds is on the source: the Hub
 * surfaces are not allowed to name a foreground colour that cannot flip.
 *
 * The exceptions below are real and deliberate — each is a surface that stays
 * dark in BOTH themes, so fixed white ink on it is correct rather than lazy.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Files that paint the Hub's own ground and must be fully themeable. */
const THEMED = [
  'src/components/hub/HubAppsGrid.tsx',
  'src/components/hub/HubCarousel.tsx',
  'src/components/hub/HubComingSoon.tsx',
  'src/components/hub/HubHeader.tsx',
  'src/components/hub/HubBottomNav.tsx',
  'src/components/hub/HubSubShell.tsx',
  'src/components/hub/HubWalletCard.tsx',
  'src/app/hub/components/HubSkeleton.tsx',
  'src/app/hub/components/AIDrawer.tsx',
  'src/components/LanguageSwitcher.module.css',
];

/** `#fff`, `#ffffff`, `#ffffffXX`, `rgba(255,255,255,…)` — with or without spaces. */
const HARDCODED_WHITE = /#fff(?:f{3}|f{5})?\b|rgba\(\s*255\s*,\s*255\s*,\s*255/i;

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');

describe('Hub surfaces are theme-driven', () => {
  it.each(THEMED)('%s names no un-flippable white', (file) => {
    const offenders = read(file)
      .split('\n')
      .map((line, i) => [i + 1, line] as const)
      // A badge on a red dot is white in both themes by definition; it is ink on
      // a fixed-colour object, not ink on the page.
      .filter(([, line]) => HARDCODED_WHITE.test(line) && !/--tec-red|var\(--tec-red\)/.test(line))
      .map(([n, line]) => `${n}: ${line.trim().slice(0, 100)}`);

    expect(offenders).toEqual([]);
  });
});

describe('the balance card is a card like any other', () => {
  it('is painted from the shared surface, not a private one', () => {
    const card = read('src/components/hub/HubWalletCard.tsx');
    expect(card).toContain("background: 'var(--tec-surface-1)'");
    // It has been three things: a purple->navy->green gradient, then a fixed
    // dark slab (--tec-hero) that stayed dark on a light page. Both made the
    // first element the eye lands on the one that ignored the system.
    expect(card).not.toContain('#0a1628');
    expect(card).not.toContain('rgba(6,182,212');
    // Usage, not the name — the comment above it names the token to explain
    // why the card no longer has one, and that history is worth keeping.
    expect(card).not.toContain('var(--tec-hero');
  });

  it('leaves no orphan hero token behind in the palette', () => {
    // A token with no user is a thing the next reader has to rule out.
    expect(read('src/styles/tec-design-tokens.css')).not.toContain('--tec-hero');
  });
});

describe('every group in the launcher is the same card', () => {
  it('Favourites is not exempt from the box', () => {
    // It rendered transparent and borderless while every other group was a
    // bounded card, so it read as a stray tile left on the background. What
    // makes it featured is the tile treatment inside it.
    const grid = read('src/components/hub/HubAppsGrid.tsx');
    expect(grid).not.toMatch(/featured \? 'transparent'/);
    expect(grid).not.toMatch(/featured \? 'none'/);
  });
});

describe('every theme-flipping token exists in both palettes', () => {
  const css = read('src/styles/tec-design-tokens.css');
  const light = css.slice(css.indexOf("[data-theme='light']"), css.indexOf('@media (prefers-color-scheme: light)'));
  const system = css.slice(css.indexOf('@media (prefers-color-scheme: light)'));

  it.each([
    '--tec-text-1', '--tec-text-2', '--tec-text-3', '--tec-text-4',
    '--tec-icon', '--tec-fill-soft', '--tec-fill-softer',
    '--tec-bg', '--tec-surface-1', '--tec-surface-2', '--tec-surface-3',
    '--tec-border', '--tec-gold', '--tec-gold-rgb', '--tec-band',
  ])('%s is redefined for light', (token) => {
    // A token defined only on :root silently keeps its dark value on a light
    // page — the exact failure this whole guard exists for.
    expect(light).toContain(`${token}:`);
    expect(system).toContain(`${token}:`);
  });
});
