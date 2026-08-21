/**
 * The intermittent white strip at the bottom of the screen.
 *
 * Only `body` carried the page background, so anything the browser painted OUTSIDE the
 * body box came out white: the strip left when the mobile URL bar hides, the overscroll
 * area, and the gap under a `bottom: 0` element. It appeared exactly when the viewport
 * and the body box disagreed — which is why it came and went.
 *
 * A rendering test cannot catch this (jsdom paints nothing), so the guard is on the
 * stylesheet itself: these declarations must not be removed again.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

/** The `html { ... }` block, whitespace-normalised. */
const htmlBlock = /html\s*\{([^}]*)\}/.exec(css)?.[1]?.replace(/\s+/g, ' ') ?? '';
const bodyBlock = /\bbody\s*\{([^}]*)\}/.exec(css)?.[1]?.replace(/\s+/g, ' ') ?? '';

describe('page paint', () => {
  it('paints the html element, not only body', () => {
    expect(htmlBlock).toMatch(/background:/);
  });

  it('keeps body painted too', () => {
    expect(bodyBlock).toMatch(/background:/);
  });

  it('declares a dark color-scheme so browser chrome is not painted light', () => {
    expect(htmlBlock).toMatch(/color-scheme:\s*dark/);
  });

  it('sizes body to the visible viewport on mobile, with a vh fallback', () => {
    expect(bodyBlock).toMatch(/min-height:\s*100vh/);
    expect(bodyBlock).toMatch(/min-height:\s*100dvh/);
    // Order matters: the fallback must come FIRST or it overrides dvh.
    expect(bodyBlock.indexOf('100vh')).toBeLessThan(bodyBlock.indexOf('100dvh'));
  });

  it('stops the overscroll bounce that exposed the unpainted area', () => {
    expect(bodyBlock).toMatch(/overscroll-behavior-y:\s*none/);
  });
});
