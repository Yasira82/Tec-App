/**
 * Response parsers for the Dashboard.
 *
 * Every bug these guard against had the same shape: the UI read a field the backend
 * never sends, got `undefined`, and silently rendered a wrong-but-plausible value —
 * "Free" for an Enterprise user, "KYC Pending" for a verified one, "Invalid Date" on
 * every row. Parsing lives here, in one place, with tests pinning the REAL shapes.
 */

export interface Payment {
  id:        string;
  amount:    number;
  status:    string;
  type:      string;
  createdAt: string;
  txHash?:   string;
}

/**
 * Normalize a raw payment record from the gateway.
 *
 * The services return snake_case (`created_at`) — reading `createdAt` straight off the
 * raw object yielded `undefined` → every row rendered "Invalid Date" and an unlabeled
 * type, and the 7-day chart matched nothing so it always looked empty. Accept BOTH
 * spellings so the row is correct whichever service shape arrives.
 */
export function normalizePayment(raw: Record<string, unknown>): Payment {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = raw?.[k];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return undefined;
  };
  return {
    id:        String(pick('id', 'payment_id', 'paymentId') ?? ''),
    amount:    Number(pick('amount', 'value') ?? 0),
    status:    String(pick('status') ?? 'pending').toLowerCase(),
    type:      String(pick('type', 'payment_type', 'paymentType', 'direction') ?? 'payment').toLowerCase(),
    createdAt: String(pick('createdAt', 'created_at', 'createdOn', 'timestamp') ?? ''),
    txHash:    pick('txHash', 'tx_hash', 'transaction_id') as string | undefined,
  };
}

/** Format a date, or return null when the source value isn't a usable date. */
export function formatTxDate(value: string, locale: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Read KYC verification from the kyc-service envelope: `{ data: { kyc: { status } } }`.
 *
 * The Dashboard previously looked for a `verified` / `kycVerified` boolean — neither
 * field exists in that payload, so it resolved false and showed "KYC Pending" to a
 * fully verified user (while /dashboard/kyc showed "Verified · Level L1"). Status is
 * the real field; the booleans stay as fallbacks. Fails closed to unverified (P6).
 */
export function isKycVerified(raw: unknown): boolean {
  const d = raw as { data?: { kyc?: Record<string, unknown> } & Record<string, unknown> } & Record<string, unknown>;
  const k = (d?.data?.kyc ?? d?.data ?? d) as Record<string, unknown> | undefined;
  if (typeof k?.status === 'string') return k.status.toUpperCase() === 'VERIFIED';
  return k?.verified === true || k?.kycVerified === true;
}
