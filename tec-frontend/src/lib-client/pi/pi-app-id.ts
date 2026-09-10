/**
 * Which Pi app to tell the SDK it is talking to — decided by the HOST.
 *
 * `NEXT_PUBLIC_PI_APP_ID` is ONE Vercel variable holding the MAINNET Hub's app
 * id, inlined at build time. The Hub is registered with Pi TWICE against the
 * same deployment:
 *
 *   hub.tecosystem.app          → tec-app-923b947851f9dfe1   (Mainnet)
 *   tec-app-frontend.vercel.app → tec-app-de161fa2243c797b   (Testnet)
 *
 * Two different apps, two different ids, one build. So on the Testnet host that
 * variable names the WRONG app, and the SDK stops answering — silently. There
 * is no error and no log, because from the SDK's point of view nothing failed.
 *
 * Passing NOTHING is the fix, and it is not a workaround: it is what every one
 * of the other 25 repos already does. The SDK resolves the app from the host,
 * which is the only thing that differs between a Mainnet app and its paired
 * Testnet twin — and precisely why one build can serve both.
 *
 * ── Why this lives in its own file ──────────────────────────────────────────
 * The id was read straight from `process.env` in FOUR places: the SDK loader,
 * the session's ensureAuth, the payment path, and mint. Fixing only the loader
 * fixed nothing that mattered, because `pi-payment.ts` calls `reInit(...)` with
 * its own copy two lines before `createPayment` — re-pointing the SDK at the
 * wrong app at the exact moment it matters. Four readers of one build-time
 * constant is four chances to disagree; there is now one.
 */

/** `*.vercel.app` is the paired Testnet host; a custom domain is Mainnet. */
export const isPiTestnetHost = (): boolean =>
  typeof window !== 'undefined' && /\.vercel\.app$/i.test(window.location.hostname);

/**
 * The app id for `Pi.init` — `undefined` on the Testnet host, so the SDK reads
 * the app from the host instead. The Mainnet host is untouched: it keeps the
 * configured id, which is correct there and has always worked.
 */
export const resolvePiAppId = (): string | undefined =>
  isPiTestnetHost() ? undefined : process.env.NEXT_PUBLIC_PI_APP_ID;
