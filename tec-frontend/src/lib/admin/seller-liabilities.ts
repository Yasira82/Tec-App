/**
 * What the platform owes sellers in π, next to what the Hub's app wallet holds
 * (tec-core-backend #409). Withdrawals are sent from the Hub wallet only, so the gap is
 * what the owner has to move into it. Amounts are kept to 7 places, as Pi's chain is.
 */
export interface Liabilities {
  wallet:   { balances: { currency: string; wallets: number; amount: string }[]; withdrawals_pending: { count: number; amount: string } } | null;
  payouts:  Record<string, { count: number; amount: string }> | null;
  hub:      { address: string | null; source: 'seed' | 'address' | null; exists: boolean | null; balance: string | null } | null;
}

const n = (v: string | null | undefined) => (v == null ? 0 : Number(v) || 0);
const round = (x: number) => Math.round(x * 1e7) / 1e7;

/**
 * owed = π in TEC balances + withdrawals not yet sent + seller shares not yet credited.
 * `null` when a part could not be read — a total missing a part would read as smaller
 * than it is, which is the wrong direction for money owed (P6).
 */
export function owed(l: Liabilities): number | null {
  if (!l.wallet || !l.payouts) return null;
  const pi = l.wallet.balances.find((b) => b.currency === 'PI');
  return round(n(pi?.amount) + n(l.wallet.withdrawals_pending.amount) + n(l.payouts.OWED?.amount));
}

/** How much to move into the Hub wallet: never negative; null when either side is unknown. */
export function shortfall(l: Liabilities): number | null {
  const o = owed(l);
  if (o == null || !l.hub || l.hub.balance == null) return null;
  return round(Math.max(0, o - n(l.hub.balance)));
}
