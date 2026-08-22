/**
 * The apps grid must not strand a tile.
 *
 * It was pinned to four columns, so the five-app "Trust & Intelligence" section
 * rendered as a full row of four with Analytics alone underneath — a long row
 * and a short one. These assertions pin the balance rule, because the section
 * sizes come from the registry and will keep changing as apps are added.
 */
import { describe, it, expect } from 'vitest';
import { columnsFor } from '@/components/hub/HubAppsGrid';

/** Row sizes a section of `n` items actually renders with `cols` columns. */
const rowsOf = (n: number, cols: number): number[] => {
  const rows: number[] = [];
  for (let left = n; left > 0; left -= cols) rows.push(Math.min(left, cols));
  return rows;
};

describe('columnsFor', () => {
  it('never puts more than four tiles in a row', () => {
    for (let n = 1; n <= 30; n++) expect(columnsFor(n)).toBeLessThanOrEqual(4);
  });

  it('keeps four columns for a section that fits on one row', () => {
    // Two tiles stretched across the full width would look nothing like the
    // section above them. Small sections stay start-aligned at tile size.
    for (const n of [1, 2, 3, 4]) expect(columnsFor(n)).toBe(4);
  });

  it('splits five apps 3+2 instead of 4+1 — the case that was reported', () => {
    expect(columnsFor(5)).toBe(3);
    expect(rowsOf(5, columnsFor(5))).toEqual([3, 2]);
  });

  it('uses as few rows as possible — unless one more row un-strands a tile', () => {
    // Compactness is the second priority, not the first. n = 17 spends a sixth
    // row (3×5+2) rather than ship 4+4+4+4+1.
    for (let n = 1; n <= 30; n++) {
      const rows    = rowsOf(n, columnsFor(n));
      const fewest  = Math.ceil(n / 4);
      const strands = n > 4 && n % 4 === 1;
      expect(rows.length).toBe(strands && n % 3 !== 1 ? Math.ceil(n / 3) : fewest);
    }
  });

  it('never strands a single tile when any column count can avoid it', () => {
    // The whole point: a lone trailing tile reads as a mistake. A uniform grid
    // cannot always dodge it — 13 is 4·3+1 AND 3·4+1 AND 2·6+1 — so the claim is
    // "whenever it is possible", and the test works out possibility itself
    // rather than trusting a hand-written list.
    const avoidable = (n: number) => [4, 3, 2].some((c) => n <= c || n % c !== 1);
    for (let n = 5; n <= 30; n++) {
      if (!avoidable(n)) continue;
      const rows = rowsOf(n, columnsFor(n));
      expect({ n, last: rows[rows.length - 1] }).toEqual({ n, last: expect.any(Number) });
      expect(rows[rows.length - 1]).toBeGreaterThan(1);
    }
  });

  it('fills the last row as much as the row count allows', () => {
    for (let n = 5; n <= 30; n++) {
      const cols = columnsFor(n);
      const rows = Math.ceil(n / cols);
      const last = n - cols * (rows - 1);
      // No other column count reaches the same row count with a fuller last row.
      for (const alt of [4, 3, 2]) {
        const altRows = Math.ceil(n / alt);
        if (altRows !== rows) continue;
        expect(last).toBeGreaterThanOrEqual(n - alt * (altRows - 1));
      }
    }
  });

  it('lays out the sizes the live registry actually produces', () => {
    expect(rowsOf(2, columnsFor(2))).toEqual([2]);          // Identity & Social
    expect(rowsOf(3, columnsFor(3))).toEqual([3]);          // Reputation
    expect(rowsOf(5, columnsFor(5))).toEqual([3, 2]);       // Trust & Intelligence
    expect(rowsOf(6, columnsFor(6))).toEqual([3, 3]);
    expect(rowsOf(7, columnsFor(7))).toEqual([4, 3]);
    expect(rowsOf(9, columnsFor(9))).toEqual([3, 3, 3]);
  });
});
