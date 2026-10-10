/**
 * Owed to sellers vs. the Hub wallet (tec-core-backend #409). A part that could not be
 * read makes the total "incomplete", never smaller (P6); the shortfall is never negative.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { owed, shortfall, type Liabilities } from '@/lib/admin/seller-liabilities';

const L = (over: Partial<Liabilities> = {}): Liabilities => ({
  wallet:  { balances: [{ currency: 'PI', wallets: 2, amount: '10.5' }, { currency: 'TEC', wallets: 1, amount: '99' }], withdrawals_pending: { count: 1, amount: '1' } },
  payouts: { OWED: { count: 3, amount: '2.25' }, CREDITED: { count: 1, amount: '7' } },
  hub:     { address: 'G' + 'A'.repeat(55), source: 'address', exists: true, balance: '5' },
  ...over,
});

describe('owed / shortfall', () => {
  it('π balances + pending withdrawals + OWED sales; TEC and CREDITED are not added', () => {
    expect(owed(L())).toBe(13.75);
    expect(shortfall(L())).toBe(8.75);
  });

  it('a part not read → total unknown, never smaller', () => {
    expect(owed(L({ payouts: null }))).toBeNull();
    expect(owed(L({ wallet: null }))).toBeNull();
    expect(shortfall(L({ hub: { address: 'G', source: null, exists: null, balance: null } }))).toBeNull();
  });

  it('the Hub wallet holds more than owed → 0 to move', () => {
    expect(shortfall(L({ hub: { address: 'G', source: 'seed', exists: true, balance: '100' } }))).toBe(0);
  });
});

describe('the BFF', () => {
  it('asks the three owners with the session token only', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/api/admin/seller-liabilities/route.ts'), 'utf8');
    for (const p of ['/api/wallets/admin/liabilities', '/api/commerce/payouts/summary', '/api/payment/admin/app-wallet']) expect(src).toContain(p);
    expect(src).not.toMatch(/'x-internal-key'\s*:/);
  });
});
