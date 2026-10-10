/**
 * Admin Payment networks (tec-core-backend #401): pages add up, and the BFF forwards
 * only the session token and the three parameters the service understands.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { accumulate, short, zero } from '@/lib/admin/payment-networks';

const page = (over: Partial<Parameters<typeof accumulate>[1]> = {}) => ({
  checked: 2, total: 3, done: false, marked_testnet_but_mainnet: [], sums: zero(), ...over,
});

describe('accumulate', () => {
  it('adds each network across pages, in exact-ish decimals, and tracks progress', () => {
    const s1 = zero(); s1.mainnet = { count: 1, amount: '0.1' }; s1.testnet = { count: 1, amount: '1' };
    const s2 = zero(); s2.mainnet = { count: 1, amount: '0.2' };
    const a = accumulate(undefined, page({ sums: s1 }), 0);
    const b = accumulate(a, page({ checked: 1, done: true, sums: s2, marked_testnet_but_mainnet: ['p9'] }), 2);
    expect(b.sums.mainnet).toEqual({ count: 2, amount: '0.3' });
    expect(b.sums.testnet).toEqual({ count: 1, amount: '1' });
    expect(b.checked).toBe(3);
    expect(b.done).toBe(true);
    expect(b.odd).toEqual(['p9']);
  });
});

describe('sender → receiver routes (tec-core-backend #407)', () => {
  it('the same route adds up across pages; biggest first', () => {
    const r = (from: string, to: string, count: number, amount: string) => ({ network: 'mainnet' as const, from, to, count, amount });
    const a = accumulate(undefined, page({ routes: [r('GAKCH', 'GAKCH', 2, '6')] }), 0);
    const b = accumulate(a, page({ routes: [r('GAKCH', 'GAKCH', 1, '1'), r('GX', 'GY', 1, '10')] }), 2);
    expect(b.routes).toEqual([r('GX', 'GY', 1, '10'), r('GAKCH', 'GAKCH', 3, '7')]);
    expect(a.routes[0].count).toBe(2);
  });

  it('an address is shown the way Pi\'s wallet shows it', () => {
    expect(short('GAKCHABCDEFGHIJKLMNOPXFAX')).toBe('GAKCH…PXFAX');
    expect(short(null)).toBe('unknown');
  });
});

describe('the admin BFF route', () => {
  it('sends only the session token, never the internal key, and forwards only userId/offset/limit', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/api/admin/payment-networks/route.ts'), 'utf8');
    expect(src).toContain('/api/payment/admin/network-report');
    expect(src).not.toMatch(/'x-internal-key'\s*:/);
    expect(src).toMatch(/\['userId', 'offset', 'limit'\]/);
  });
});
