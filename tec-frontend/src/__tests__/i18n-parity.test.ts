/**
 * The two dictionaries must have the SAME SHAPE.
 *
 * A half-translated screen is the normal failure mode of adding a language: a key
 * lands in `en.ts`, the Arabic one is forgotten, and the page renders `undefined`
 * — or worse, the type system is satisfied because `ar` was typed as
 * `typeof en` and someone widened it. Nothing in a build catches a key that
 * exists in one file and not the other once that happens.
 *
 * Placeholders get the same treatment. `{n}` and `{days}` are the only reason a
 * count can sit inside a translated sentence instead of being concatenated around
 * it; a translation that drops one silently loses the number.
 */
import { describe, it, expect } from 'vitest';
import { en } from '@/lib/i18n/en';
import { ar } from '@/lib/i18n/ar';
import { fill } from '@/lib/i18n';

type Tree = { [k: string]: string | Tree };

/** Every leaf as `a.b.c` → its string, so the two files can be compared flat. */
function flatten(node: unknown, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(node as Tree)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.set(path, v);
    else if (v && typeof v === 'object') for (const [p, s] of flatten(v, path)) out.set(p, s);
  }
  return out;
}

const EN = flatten(en);
const AR = flatten(ar);

const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();

describe('en ⟺ ar dictionary parity', () => {
  it('translates every English key', () => {
    expect([...EN.keys()].filter(k => !AR.has(k))).toEqual([]);
  });

  it('carries no Arabic key without an English original', () => {
    // A stale key left behind after an English rename — dead weight that reads as
    // coverage.
    expect([...AR.keys()].filter(k => !EN.has(k))).toEqual([]);
  });

  it('leaves no empty string on either side', () => {
    expect([...EN].filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
    expect([...AR].filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
  });

  it('keeps the same placeholders in both languages', () => {
    const mismatched = [...EN]
      .filter(([k, v]) => String(placeholders(v)) !== String(placeholders(AR.get(k) ?? '')))
      .map(([k]) => k);
    expect(mismatched).toEqual([]);
  });

  it('actually translates the copy — Arabic is not a copy of English', () => {
    // Brand names and symbols legitimately match (TEC, PRO, π, Pi). Prose must not:
    // an Arabic value identical to a long English sentence is an untranslated stub.
    // Long values that are deliberately identical, each for a stated reason —
    // length alone cannot tell these apart from a forgotten string.
    const SAME_BY_DESIGN = new Set([
      // The full brand name, written the same way in both languages.
      'common.brand',
      // Expands the three ENGLISH letters T, E, C. An Arabic expansion
      // (ثقة · منظومة · تواصل) spells ث·م·ت — it would no longer be a legend
      // for the wordmark it sits under.
      'common.acronym',
    ]);
    const untranslated = [...EN]
      .filter(([k, v]) => v.length > 24 && AR.get(k) === v && !SAME_BY_DESIGN.has(k))
      .map(([k]) => k);
    expect(untranslated).toEqual([]);
  });
});

describe('fill', () => {
  it('substitutes every named placeholder', () => {
    expect(fill('{n} unread', { n: 3 })).toBe('3 unread');
    expect(fill('a free {days}-day month', { days: 30 })).toBe('a free 30-day month');
  });

  it('leaves an unknown placeholder visible rather than blanking it', () => {
    // A literal `{days}` on screen is a bug you can see. An empty gap is one you cannot.
    expect(fill('{days} left', {})).toBe('{days} left');
  });

  it('fills a placeholder used more than once', () => {
    expect(fill('{n} of {n}', { n: 2 })).toBe('2 of 2');
  });
});
