import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * No Hub source file over 600 lines without a recorded reason (TEC-AUDIT-0007).
 *
 * A file that size is one nobody reads whole before changing it. The largest were
 * split on 13 Nov 2026; what is left over the line is below, each with its reason and
 * its size TODAY as a ceiling — it may shrink, never grow. A new file over 600 lines
 * fails here; so does a listed one that grew. Shrink a ceiling when a file shrinks.
 */
const LIMIT = 600;

// Data, not logic: one key per line of a dictionary or a registry. Splitting them
// would scatter one table across files and gain nothing.
const DATA = [/^src\/lib\/i18n\/[a-z]{2}\.ts$/, /^src\/domains\/_registry\.ts$/];

const OVER: Record<string, { ceiling: number; reason: string }> = {
  'src/app/hub/campaign/page.tsx': {
    ceiling: 1229,
    reason: "The live campaign's screens (rounds, claims, pick, report). No test drives them end to end yet; a split waits for one, not mid-campaign.",
  },
  'src/app/pioneers/PioneersClient.tsx': {
    ceiling: 881,
    reason: 'The public Pioneers page — sections of one long page. To split along its sections, with a render test first.',
  },
  'src/app/hub/admin/campaign/page.tsx': {
    ceiling: 671,
    reason: "The campaign's admin console. Same as the campaign page: split after it, with it.",
  },
  'src/app/dashboard/page.tsx': {
    ceiling: 624,
    reason: 'The dashboard; 24 lines over. Next to split, along its cards.',
  },
};

const SRC = join(process.cwd(), 'src');
const files = (d: string): string[] => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  if (statSync(p).isDirectory()) return n === '__tests__' ? [] : files(p);
  return /\.(ts|tsx)$/.test(n) && !/\.(test|spec)\./.test(n) ? [p] : [];
});
const lines = (f: string) => readFileSync(f, 'utf8').split('\n').length - 1;

describe('source file size', () => {
  const sizes = files(SRC).map((f) => ({ path: relative(process.cwd(), f), n: lines(f) }));

  it('no file over 600 lines without a recorded reason', () => {
    const unrecorded = sizes
      .filter(({ path, n }) => n > LIMIT && !OVER[path] && !DATA.some((r) => r.test(path)))
      .map(({ path, n }) => `${path} (${n})`);
    expect(unrecorded).toEqual([]);
  });

  it('a recorded file does not grow past its ceiling', () => {
    const grew = sizes
      .filter(({ path, n }) => OVER[path] && n > OVER[path].ceiling)
      .map(({ path, n }) => `${path}: ${n} > ${OVER[path].ceiling}`);
    expect(grew).toEqual([]);
  });

  it('every entry still exists and is still over the line (else remove it)', () => {
    for (const path of Object.keys(OVER)) {
      const found = sizes.find((s) => s.path === path);
      expect(found, path).toBeTruthy();
      expect(found!.n, path).toBeGreaterThan(LIMIT);
    }
  });
});
