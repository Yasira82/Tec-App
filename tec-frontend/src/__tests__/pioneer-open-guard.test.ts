/**
 * A Founding place cannot be taken with strings.
 *
 * Before this, `POST /api/bff/pioneer/open` accepted `app` as any string of 1–40
 * characters. Twenty-four requests carrying 'a'..'x' completed the 24-app Quest
 * and were granted a permanent, scarce Founding number — without opening a single
 * app. The badge is advertised as "cannot be bought, only earned", so a Quest
 * anyone can assert is the one thing that makes the claim untrue.
 *
 * The authority is `tec-identity-service`, which keeps its own fixed roster. This
 * pins the Hub's pre-check (P5: pre-validation never becomes the gate).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LIVE_DOMAINS } from '@/domains/_registry';

const route = readFileSync(
  join(process.cwd(), 'src/app/api/bff/pioneer/open/route.ts'),
  'utf8',
);

describe('the open route no longer takes any string', () => {
  it('does not accept a free-form slug', () => {
    // The exact shape that shipped the hole.
    expect(route).not.toMatch(/app:\s*z\.string\(\)\.min\(1\)\.max\(40\)/);
  });

  it('checks the slug against the live registry', () => {
    expect(route).toContain('LIVE_DOMAINS');
    expect(route).toMatch(/refine\(\(s\) => LIVE_SLUGS\.has\(s\)/);
  });

  it('normalises before checking, so "  ZONE  " is still Zone', () => {
    // A person tapping a real app must never be refused on whitespace.
    expect(route).toMatch(/z\.string\(\)\.trim\(\)\.toLowerCase\(\)/);
  });
});

describe('the roster the Hub checks against', () => {
  const slugs = LIVE_DOMAINS.map((d) => d.slug);

  it('is the 24 live apps the Quest asks for', () => {
    expect(slugs).toHaveLength(24);
  });

  it('holds no duplicates — a repeat would make the Quest shorter than it looks', () => {
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('contains none of the letters the old exploit used', () => {
    // If a one-letter slug were ever added, the pre-check would stop refusing the
    // cheapest possible forgery. Worth knowing at that moment, not after.
    for (const s of slugs) expect(s.length).toBeGreaterThan(1);
  });
});
