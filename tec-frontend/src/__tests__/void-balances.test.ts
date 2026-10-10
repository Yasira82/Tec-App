/**
 * Admin: reverse unbacked TEC balances (tec-core-backend #402). The BFF forwards only
 * the session token and the three fields of a reviewed run; the page needs the typed phrase.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');

describe('void-balances', () => {
  it('the BFF sends the session token only and forwards only runId/expectedTotal/confirm', () => {
    const src = read('src/app/api/admin/void-balances/route.ts');
    expect(src).toContain('/api/wallets/admin/void-unbacked');
    expect(src).not.toMatch(/'x-internal-key'\s*:/);
    expect(src).toMatch(/JSON\.stringify\(\{ runId, expectedTotal, confirm \}\)/);
  });

  it('the page runs only with the dry run total and the exact phrase', () => {
    const src = read('src/app/hub/admin/void-balances/page.tsx');
    expect(src).toMatch(/expectedTotal: plan\.total/);
    expect(src).toMatch(/disabled=\{busy \|\| typed !== plan\.confirm\}/);
  });
});
