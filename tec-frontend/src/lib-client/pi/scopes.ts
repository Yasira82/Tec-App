/**
 * The Pi scopes this app asks for, in ONE place.
 *
 * ─── Why one place ───────────────────────────────────────────────────────────
 * Two production call sites authenticate — `pi-auth.ts` (login) and
 * `pi-session.ts` (the payment path) — and they are not merely similar, they
 * are COUPLED: after login succeeds, `piSession.markAuthenticated()` tells the
 * session manager not to run a second authenticate, on the stated grounds that
 * the scopes are the same. If the two lists ever diverged, a payment would
 * reuse a session granted a NARROWER set, and the missing scope would surface
 * as a refusal from Pi with no local trace of why.
 *
 * Two copies of a list that must be identical is the shape of bug this
 * platform has shipped more than once. So: one array, imported.
 *
 * ─── Why `wallet_address` ────────────────────────────────────────────────────
 * Without it the app CANNOT PAY ANYONE. Pi's App-to-User create call answers:
 *
 *     401  missing_scope
 *     User hasn't authorized "wallet_address" scope
 *
 * That is a verbatim production response, from the first real payout round
 * (2026-09-12): every recipient failed, and the payout wallet, the API key and
 * the network were all correct. The recipient has to have granted the app
 * permission to learn their wallet address before the app can send to it.
 *
 * This is not only the Pi Portal's 5-wallet gate. The Hub's own home screen
 * advertises a reward campaign — "claim real Pi" — and pays it through the same
 * A2U path. Without this scope that campaign could never have paid a single
 * person, on Mainnet either, and nothing would have said so until the first
 * attempt.
 *
 * ─── What it costs ───────────────────────────────────────────────────────────
 * A wider consent prompt at login. That is a real cost and it is worth stating
 * plainly: users are being asked for one more permission than before. It buys
 * the ability to send them Pi, which is a thing the product already promises.
 *
 * `wallet_address` lets the app READ where to send. It does not grant the app
 * any power to move the user's own balance — that still needs the user to
 * approve each payment.
 */
export const PI_SCOPES = ['username', 'payments', 'wallet_address'] as const;

export type PiScope = (typeof PI_SCOPES)[number];

/**
 * A fresh mutable copy per call.
 *
 * `Pi.authenticate` takes a plain array, and handing the same array instance to
 * an SDK we do not control is an invitation for it to be sorted, spliced or
 * kept. The constant above is the contract; this is what goes over the wall.
 */
export const piScopes = (): string[] => [...PI_SCOPES];
