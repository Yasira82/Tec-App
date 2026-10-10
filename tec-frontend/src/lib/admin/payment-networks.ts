/**
 * Running totals for the admin Payment networks page (tec-core-backend #401):
 * one payer's payments are checked on the chain a page at a time, and each page
 * is added to what came before. Amounts are kept to 8 places, as the ledger is.
 */
export interface Bucket { count: number; amount: string }
export type Network = 'mainnet' | 'testnet' | 'not_found' | 'unknown';
export interface Payer { user_id: string; payments: Bucket; marked_testnet: Bucket; no_txid: Bucket }
/** Who sent the π and who received it, summed per route (tec-core-backend #407). */
export interface Route { network: Network; from: string | null; to: string | null; count: number; amount: string }
export interface Page { checked: number; total: number; done: boolean; sums: Record<Network, Bucket>; marked_testnet_but_mainnet: string[]; routes?: Route[] }
export interface Result { checked: number; total: number; done: boolean; sums: Record<Network, Bucket>; odd: string[]; routes: Route[]; error?: string }

/** A Pi address, short enough for a phone: GAKCH…PXFAX — the way Pi's wallet shows it. */
export const short = (a: string | null): string => (a ? (a.length > 12 ? `${a.slice(0, 5)}…${a.slice(-5)}` : a) : 'unknown');

const addB = (a: Bucket, b: Bucket): Bucket => ({
  count:  a.count + b.count,
  amount: String(Math.round((Number(a.amount) + Number(b.amount)) * 1e8) / 1e8),
});

export const zero = (): Record<Network, Bucket> => ({
  mainnet: { count: 0, amount: '0' }, testnet: { count: 0, amount: '0' },
  not_found: { count: 0, amount: '0' }, unknown: { count: 0, amount: '0' },
});

export const accumulate = (prev: Result | undefined, page: Page, offset: number): Result => {
  const base = prev ?? { checked: 0, total: page.total, done: false, sums: zero(), odd: [], routes: [] };
  const sums = { ...base.sums };
  (Object.keys(sums) as Network[]).forEach((k) => { sums[k] = addB(sums[k], page.sums[k]); });
  const routes = base.routes.map((r) => ({ ...r }));
  for (const r of page.routes ?? []) {
    const hit = routes.find((x) => x.network === r.network && x.from === r.from && x.to === r.to);
    if (hit) Object.assign(hit, addB(hit, r));
    else routes.push({ ...r });
  }
  routes.sort((a, b) => Number(b.amount) - Number(a.amount));
  return { checked: offset + page.checked, total: page.total, done: page.done, sums, odd: [...base.odd, ...page.marked_testnet_but_mainnet], routes };
};
