/**
 * Running totals for the admin Payment networks page (tec-core-backend #401):
 * one payer's payments are checked on the chain a page at a time, and each page
 * is added to what came before. Amounts are kept to 8 places, as the ledger is.
 */
export interface Bucket { count: number; amount: string }
export type Network = 'mainnet' | 'testnet' | 'not_found' | 'unknown';
export interface Payer { user_id: string; payments: Bucket; marked_testnet: Bucket; no_txid: Bucket }
export interface Page { checked: number; total: number; done: boolean; sums: Record<Network, Bucket>; marked_testnet_but_mainnet: string[] }
export interface Result { checked: number; total: number; done: boolean; sums: Record<Network, Bucket>; odd: string[]; error?: string }

const addB = (a: Bucket, b: Bucket): Bucket => ({
  count:  a.count + b.count,
  amount: String(Math.round((Number(a.amount) + Number(b.amount)) * 1e8) / 1e8),
});

export const zero = (): Record<Network, Bucket> => ({
  mainnet: { count: 0, amount: '0' }, testnet: { count: 0, amount: '0' },
  not_found: { count: 0, amount: '0' }, unknown: { count: 0, amount: '0' },
});

export const accumulate = (prev: Result | undefined, page: Page, offset: number): Result => {
  const base = prev ?? { checked: 0, total: page.total, done: false, sums: zero(), odd: [] };
  const sums = { ...base.sums };
  (Object.keys(sums) as Network[]).forEach((k) => { sums[k] = addB(sums[k], page.sums[k]); });
  return { checked: offset + page.checked, total: page.total, done: page.done, sums, odd: [...base.odd, ...page.marked_testnet_but_mainnet] };
};
