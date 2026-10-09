/**
 * One Pioneer, one account (tec-core-backend #395/#396): auth-service's refresh may move a
 * session that sat on a duplicate account to the Pioneer's oldest, and says which. The
 * Hub's `tec_user` cookie then carries that id — every other field exactly as it was.
 */
/** `tec_user` with its `id` set to the account the new tokens are for; unchanged otherwise. */
export function withAccountId(raw: string | undefined, accountId: unknown): string | undefined {
  if (!raw || typeof accountId !== 'string' || !accountId) return raw;
  try {
    const u = JSON.parse(raw) as Record<string, unknown>;
    if (!u || typeof u !== 'object' || u.id === accountId) return raw;
    return JSON.stringify({ ...u, id: accountId });
  } catch {
    return raw;
  }
}
