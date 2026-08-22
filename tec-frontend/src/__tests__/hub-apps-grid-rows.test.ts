/**
 * The launcher sits on ONE set of vertical rails.
 *
 * A previous rule picked the column count per section to avoid a lone trailing
 * tile (5 -> 3+2). It worked, and it broke something more visible: a five-app
 * section sat on 3 rails while the section above it sat on 4, so the same app
 * showed up at two different x-positions on one screen. The two goals conflict;
 * alignment is the one that carries.
 *
 * This is a one-line constant, so the test is not about arithmetic — it is here
 * to make a future "let's balance the rows" change state its case against the
 * reason it was reverted, instead of quietly reintroducing the drift.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GRID_COLUMNS } from '@/components/hub/HubAppsGrid';

const SRC = readFileSync(join(process.cwd(), 'src/components/hub/HubAppsGrid.tsx'), 'utf8');

/** Row sizes a section of `n` items renders with the fixed column count. */
const rowsOf = (n: number): number[] => {
  const rows: number[] = [];
  for (let left = n; left > 0; left -= GRID_COLUMNS) rows.push(Math.min(left, GRID_COLUMNS));
  return rows;
};

describe('the apps grid', () => {
  it('uses four columns', () => {
    expect(GRID_COLUMNS).toBe(4);
  });

  it('uses the SAME column count for every section — the rails must not move', () => {
    // One template literal, one constant, no per-section branch. A section that
    // computed its own width is exactly the regression this guards.
    const templates = SRC.match(/gridTemplateColumns: [^,\n]+/g) ?? [];
    expect(templates.length).toBeGreaterThan(0);
    for (const t of templates) {
      expect(t).toContain('GRID_COLUMNS');
      expect(t).not.toMatch(/items\.length|\.length\)/);
    }
  });

  it('puts every section on the same tile positions, whatever its size', () => {
    // Two sections of different sizes must agree on where column 1..4 are — that
    // is the whole point. With a fixed count, row 1 is identical for both.
    const small = rowsOf(2);
    const big   = rowsOf(5);
    expect(small[0]).toBe(Math.min(2, GRID_COLUMNS));
    expect(big[0]).toBe(GRID_COLUMNS);
  });

  it('lays out the sizes the live registry produces', () => {
    expect(rowsOf(2)).toEqual([2]);           // Identity & Social
    expect(rowsOf(3)).toEqual([3]);           // Real World
    expect(rowsOf(5)).toEqual([4, 1]);        // Money & Commerce — ragged, on purpose
    expect(rowsOf(23)).toEqual([4, 4, 4, 4, 4, 3]);
  });

  it('never puts more than four tiles in a row', () => {
    for (let n = 1; n <= 30; n++) {
      expect(Math.max(...rowsOf(n))).toBeLessThanOrEqual(4);
    }
  });
});
