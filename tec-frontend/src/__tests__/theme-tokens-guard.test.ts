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

describe('the deliberate exceptions are declared, not accidental', () => {
  it('the balance card is dark in both themes and says why', () => {
    const css = read('src/styles/tec-design-tokens.css');
    expect(css).toContain('--tec-hero:');
    expect(css).toContain('--tec-hero-ink-1:');
    // The reason has to live next to the token, or the next reader "fixes" it.
    expect(css).toMatch(/dark object in BOTH themes/i);

    const card = read('src/components/hub/HubWalletCard.tsx');
    expect(card).toContain('var(--tec-hero)');
    // Ink inside the card uses the hero scale, never the page scale.
    expect(card).not.toMatch(HARDCODED_WHITE);
  });

  it('drops the tri-colour gradient that made the card read as a game', () => {
    const card = read('src/components/hub/HubWalletCard.tsx');
    expect(card).not.toContain('#0a1628');
    expect(card).not.toContain('rgba(6,182,212');
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
    '--tec-border', '--tec-gold', '--tec-band',
  ])('%s is redefined for light', (token) => {
    // A token defined only on :root silently keeps its dark value on a light
    // page — the exact failure this whole guard exists for.
    expect(light).toContain(`${token}:`);
    expect(system).toContain(`${token}:`);
  });
});
