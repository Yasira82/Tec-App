// The origins the Hub is allowed to hand a user back to.
//
// ONE list, two consumers: SSO (`/api/auth/sso`, which hands the target a
// signed token) and the Mode-1 payment return (`useExternalPayment`, which
// navigates the user back with `payment_id` and `txid` on the URL). They were
// never allowed to disagree, so they are no longer allowed to be two lists.
//
// NEVER widen an entry to a pattern (`*.vercel.app`, `tec-<app>-*`): anyone can
// deploy such a host. Explicit origins only — that is the whole security value
// of this file.
export const ALLOWED_APP_ORIGINS: readonly string[] = [
  'https://tec-app-frontend.vercel.app',
  'https://hub.tecosystem.app',
  'https://tec-assets-app.vercel.app',
  'https://tec-assets.vercel.app',
  'https://assets.tecosystem.app',
  'https://assets.pi',
  'https://tec-commerce-app.vercel.app',
  // Commerce's REAL Vercel project host — no `tec-` prefix. Project names are
  // claimed first-come, so a host cannot be derived from an app's name.
  'https://commerce-app.vercel.app',
  'https://commerce.tecosystem.app',
  'https://commerce.pi',
  'https://ecommerce.tecosystem.app',
  'https://tec-ecommerce.vercel.app',
  'https://analytics.tecosystem.app',
  'https://tec-analytics-app.vercel.app',
  'https://life.tecosystem.app',
  'https://tec-life.vercel.app',
  'https://connection.tecosystem.app',
  'https://tec-connection.vercel.app',
  'https://zone.tecosystem.app',
  'https://tec-zone.vercel.app',
  // Zone's REAL Vercel host: the project name `tec-zone` was taken, so
  // Vercel appended a suffix. Both are listed — the plain one may become
  // valid later, and an allowlist entry that resolves to nothing is inert.
  'https://tec-zone-mu.vercel.app',
  'https://nexus.tecosystem.app',
  'https://tec-nexus.vercel.app',
  'https://fundx.tecosystem.app',
  'https://tec-fundx.vercel.app',
  'https://estate.tecosystem.app',
  'https://tec-estate.vercel.app',
  'https://explorer.tecosystem.app',
  'https://tec-explorer.vercel.app',
  'https://system.tecosystem.app',
  'https://tec-system.vercel.app',
  'https://dx.tecosystem.app',
  'https://tec-dx.vercel.app',
  'https://alert.tecosystem.app',
  'https://tec-alert.vercel.app',
  'https://nx.tecosystem.app',
  'https://tec-nx.vercel.app',
  'https://titan.tecosystem.app',
  'https://tec-titan.vercel.app',
  'https://insure.tecosystem.app',
  'https://tec-insure.vercel.app',
  'https://epic.tecosystem.app',
  'https://tec-epic.vercel.app',
  'https://legend.tecosystem.app',
  'https://tec-legend.vercel.app',
  'https://elite.tecosystem.app',
  'https://tec-elite.vercel.app',
  // Elite's REAL Vercel host — second app found with a suffix (see Zone).
  'https://tec-elite-bvzb.vercel.app',
  'https://vip.tecosystem.app',
  'https://tec-vip.vercel.app',
  'https://nbf.tecosystem.app',
  'https://tec-nbf.vercel.app',
  // NBF's REAL Vercel host — an arbitrary word Vercel appended because
  // `tec-nbf` was taken. This is the one registered in the Pi Portal.
  'https://nbf-ivory.vercel.app',
  'https://brookfield.tecosystem.app',
  'https://tec-brookfield.vercel.app',
  // ── The `-test` pairing ───────────────────────────────────────────────────
  // Additive on purpose: the legacy `*.vercel.app` hosts stay listed and stay
  // working, so nothing breaks the moment this merges. A host that is not yet
  // registered simply resolves to nothing — an inert allowlist entry.
  'https://hub-test.tecosystem.app',
  'https://alert-test.tecosystem.app',
  'https://analytics-test.tecosystem.app',
  'https://assets-test.tecosystem.app',
  'https://brookfield-test.tecosystem.app',
  'https://commerce-test.tecosystem.app',
  'https://connection-test.tecosystem.app',
  'https://dx-test.tecosystem.app',
  'https://ecommerce-test.tecosystem.app',
  'https://elite-test.tecosystem.app',
  'https://epic-test.tecosystem.app',
  'https://estate-test.tecosystem.app',
  'https://explorer-test.tecosystem.app',
  'https://fundx-test.tecosystem.app',
  'https://insure-test.tecosystem.app',
  'https://legend-test.tecosystem.app',
  'https://life-test.tecosystem.app',
  'https://nbf-test.tecosystem.app',
  'https://nexus-test.tecosystem.app',
  'https://nx-test.tecosystem.app',
  'https://system-test.tecosystem.app',
  'https://titan-test.tecosystem.app',
  'https://vip-test.tecosystem.app',
  'https://zone-test.tecosystem.app',
];

/**
 * True when `url` is an origin this Hub may send a user to. Fails closed on a
 * malformed URL, and matches on the ORIGIN — never a prefix of the whole URL,
 * which `https://hub.tecosystem.app.evil.com` would satisfy.
 */
export const isAllowedAppUrl = (url: string): boolean => {
  try {
    return ALLOWED_APP_ORIGINS.includes(new URL(url).origin);
  } catch {
    return false;
  }
};
