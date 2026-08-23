/**
 * Two pages paint their own near-black ground in BOTH themes — the marketing
 * landing (`#080810`) and the Pioneers campaign (`#050816`). That is a design
 * choice, not an oversight: they are the first thing a visitor sees and they
 * are meant to look the same on every phone.
 *
 * The trap is that they still READ the palette. On a light phone they were
 * getting light-theme values on a black ground: the light amber (#FEA500,
 * picked to hold up on white) went muddy, and the language switcher — a
 * shared component that does follow the theme — turned near-black ink on a
 * near-black fill and disappeared entirely.
 *
 * `.tec-on-dark` re-scopes the whole dark palette for exactly this case. The
 * assertions below are the two halves that have to stay true together: the
 * roots carry the class, and the class still covers every token a component
 * dropped onto those pages might ask for.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');

describe('the permanently-dark pages opt out of the theme', () => {
  it.each([
    ['src/app/page.tsx',                     'the marketing landing'],
    ['src/app/pioneers/PioneersClient.tsx',  'the Pioneers campaign'],
  ])('%s carries tec-on-dark', (file) => {
    expect(read(file)).toContain('tec-on-dark');
  });
});

describe('the scope covers what lands on those pages', () => {
  const css   = read('src/styles/tec-design-tokens.css');
  const scope = css.slice(css.indexOf('.tec-on-dark {'), css.indexOf('}', css.indexOf('.tec-on-dark {')));

  it('exists at all', () => {
    expect(scope).toBeTruthy();
  });

  it.each([
    // The hue and everything derived from it.
    '--tec-gold', '--tec-gold-rgb', '--tec-gold-dark', '--tec-on-gold',
    // Ink — the half that made the language pill vanish.
    '--tec-text-1', '--tec-text-2', '--tec-text-3', '--tec-icon',
    // Neutrals, so a shared card is a card and not a white slab on black.
    '--tec-surface-1', '--tec-surface-2', '--tec-border', '--tec-fill-soft',
  ])('pins %s', (token) => {
    expect(scope).toContain(`${token}:`);
  });

  it('pins the DARK amber, never the light one', () => {
    // Pinning #FEA500 here would reintroduce the exact bug: the deep amber
    // meant for white ground, painted on black.
    expect(scope).toMatch(/--tec-gold:\s*#FBB44A/i);
    expect(scope).not.toMatch(/#FEA500/i);
  });

  it('is not just an alias of the band scope', () => {
    // `.tec-on-band` re-scopes surfaces to a translucent fill over the band
    // colour. Applied to a whole page that flattens every card into one sheet.
    expect(scope).not.toContain('--tec-topbar-fill');
  });
});
