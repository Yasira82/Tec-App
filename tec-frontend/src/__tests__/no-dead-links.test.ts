/**
 * A link that goes nowhere is a promise the page does not keep: the person taps it and
 * nothing happens. `/dashboard/wallet` showed every transaction hash as `href="#"` until
 * 16 Nov 2026. Something that is not a destination is text, not a link.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  if (statSync(p).isDirectory()) return f === '__tests__' ? [] : walk(p);
  return /\.tsx$/.test(f) ? [p] : [];
});

describe('no href="#"', () => {
  it('no component links to "#"', () => {
    const hits = walk(join(__dirname, '..')).filter((p) => /href=["']#["']/.test(readFileSync(p, 'utf8')));
    expect(hits).toEqual([]);
  });
});
