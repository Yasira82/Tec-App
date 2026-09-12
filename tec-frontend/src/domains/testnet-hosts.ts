/**
 * Each app's paired TESTNET origin — the Hub's half of the two-host contract.
 *
 * ── The bug this closes ─────────────────────────────────────────────────────
 * The Hub's app grid links to `d.route`, and every route in the registry is a
 * MAINNET domain. So tapping an app from the TESTNET Hub sent the visitor to
 * the app's Mainnet host — and from there the app's own `hubPaymentOrigin`
 * correctly resolved the Mainnet Hub, so the payment came back to Mainnet with
 * no testnet marker and was approved with the Mainnet key.
 *
 * Read straight off the failing run (Vercel, 11 Sep):
 *
 *   12:35:19  tec-app-frontend.vercel.app  /api/auth/sso        307
 *   12:35:22  hub.tecosystem.app           /hub                 304
 *   12:35:22  hub.tecosystem.app           POST /api/payment/create  201
 *
 * One tap on the Testnet Hub, and three hops later the payment is a Mainnet
 * payment. Nothing in the UI said so, and a Test-Pi wallet can never pay it.
 *
 * Every other host-vs-network bug in this series was a build-time constant
 * answering a per-request question (`APP_URL`, `sandbox`, `HUB_URL`, `appId`).
 * This is the same shape once more, and the last one that still crossed the
 * networks: the apps learned to find the right Hub, but the Hub never learned
 * to find the right apps.
 *
 * ── Where these values come from ────────────────────────────────────────────
 * NOT invented, and not derived from a name. Vercel project names are claimed
 * first-come, so a host cannot be inferred: `commerce-app` has no `tec-` prefix
 * at all, and `tec-zone-mu` / `tec-elite-bvzb` carry suffixes Vercel picked.
 *
 * ── The rule these values were FIRST built on, and why it was wrong ─────────
 * They were taken mechanically as the FIRST `*.vercel.app` entry in each app's
 * own `ALLOWED_AUDIENCES`. That reads like the app is the authority — but an
 * allowlist answers "may this host sign in?", NOT "is this host ours?". Zone
 * lists BOTH `tec-zone.vercel.app` (the name it wanted, which Vercel had
 * already given to a stranger) and `tec-zone-mu.vercel.app` (the deployment).
 * First-entry picked the stranger.
 *
 * Live result: the Zone tile on the Testnet Hub opened someone else's shop —
 * a pink storefront, coincidentally also called "Tec Zone" — which then 404'd,
 * because of course it has no `/app`. The tile looked broken; it was worse
 * than broken, it was pointing off the platform.
 *
 * Each value here is now the host RECORDED FROM THE DEPLOYMENT in
 * `audits/PI_TESTNET_GATE_FINDINGS_2026-09-06.md` §8. A host is read off the
 * deployment or it is not known — an allowlist is not a deployment.
 *
 * Anything missing here simply keeps its Mainnet route — the Hub never invents
 * a host (that is how a tile becomes a 404).
 */
export const TESTNET_ORIGINS: Readonly<Record<string, string>> = {
  alert:      'https://tec-alert.vercel.app',
  analytics:  'https://tec-analytics-app.vercel.app',
  assets:     'https://tec-assets-app.vercel.app',
  brookfield: 'https://tec-brookfield.vercel.app',
  commerce:   'https://commerce-app.vercel.app',
  connection: 'https://tec-connection.vercel.app',
  dx:         'https://tec-dx.vercel.app',
  ecommerce:  'https://tec-ecommerce.vercel.app',
  elite:      'https://tec-elite-bvzb.vercel.app',
  epic:       'https://tec-epic.vercel.app',
  estate:     'https://tec-estate.vercel.app',
  explorer:   'https://tec-explorer.vercel.app',
  fundx:      'https://tec-fundx.vercel.app',
  insure:     'https://tec-insure.vercel.app',
  legend:     'https://tec-legend.vercel.app',
  life:       'https://tec-life.vercel.app',
  nbf:        'https://nbf-ivory.vercel.app',
  nexus:      'https://tec-nexus.vercel.app',
  nx:         'https://tec-nx.vercel.app',
  system:     'https://tec-system.vercel.app',
  titan:      'https://tec-titan.vercel.app',
  vip:        'https://tec-vip.vercel.app',
  zone:       'https://tec-zone-mu.vercel.app',
};

/**
 * The `-test` pairing — the SAME slugs, on subdomains of the one domain.
 *
 * Unlike the legacy map above, these ARE derived from the slug, and that is the
 * point: `vercel.app` project names are claimed first-come (`commerce-app`,
 * `nbf-ivory`), so that map had to be read off each app's own allowlist. A
 * subdomain we own has no such collision — `<slug>-test.tecosystem.app` is ours
 * by construction, which is exactly why this pairing removes a whole class of
 * "the host cannot be derived from the name" bugs.
 */
export const TESTNET_ORIGINS_PAIRED: Readonly<Record<string, string>> = {
  alert:      'https://alert-test.tecosystem.app',
  analytics:  'https://analytics-test.tecosystem.app',
  assets:     'https://assets-test.tecosystem.app',
  brookfield: 'https://brookfield-test.tecosystem.app',
  commerce:   'https://commerce-test.tecosystem.app',
  connection: 'https://connection-test.tecosystem.app',
  dx:         'https://dx-test.tecosystem.app',
  ecommerce:  'https://ecommerce-test.tecosystem.app',
  elite:      'https://elite-test.tecosystem.app',
  epic:       'https://epic-test.tecosystem.app',
  estate:     'https://estate-test.tecosystem.app',
  explorer:   'https://explorer-test.tecosystem.app',
  fundx:      'https://fundx-test.tecosystem.app',
  insure:     'https://insure-test.tecosystem.app',
  legend:     'https://legend-test.tecosystem.app',
  life:       'https://life-test.tecosystem.app',
  nbf:        'https://nbf-test.tecosystem.app',
  nexus:      'https://nexus-test.tecosystem.app',
  nx:         'https://nx-test.tecosystem.app',
  system:     'https://system-test.tecosystem.app',
  titan:      'https://titan-test.tecosystem.app',
  vip:        'https://vip-test.tecosystem.app',
  zone:       'https://zone-test.tecosystem.app',
};

/** The Hub's own paired Testnet host in each pairing. */
export const HUB_TESTNET_LEGACY = 'https://tec-app-frontend.vercel.app';
export const HUB_TESTNET_PAIRED = 'https://hub-test.tecosystem.app';


/** True on `hub-test.tecosystem.app` — the paired Hub, not the legacy one. */
export const isPairedTestnetHost = (host?: string | null): boolean =>
  /-test\.tecosystem\.app$/i.test((host ?? '').split(':')[0]?.trim() ?? '');

/**
 * Either Testnet Hub. Both pairings are live during the migration, and getting
 * this wrong is not cosmetic: it decides which app hosts the grid links to, and
 * a link into the WRONG network is how a Test-Pi visitor ends up holding a
 * Mainnet payment no test wallet can ever pay.
 */
export const isHubTestnetHost = (host?: string | null): boolean => {
  const hostname = (host ?? '').split(':')[0]?.trim() ?? '';
  return /\.vercel\.app$/i.test(hostname) || isPairedTestnetHost(hostname);
};

/**
 * The route to open for an app, given which Hub the visitor is on.
 *
 * Keeps the PATH — `/app`, `/shop` — and swaps only the origin, because the
 * path is the app's own routing and has nothing to do with the network.
 *
 * Returns the route unchanged for a relative route (Hub's own pages), for an
 * unknown slug, and on the Mainnet Hub. The Mainnet path is untouched: this
 * function cannot move a real buyer anywhere new.
 */
export const routeForNetwork = (
  route: string,
  slug:  string,
  host?: string | null,
): string => {
  if (!route.startsWith('http')) return route;
  const hostname = host ?? (typeof window === 'undefined' ? null : window.location.hostname);
  if (!isHubTestnetHost(hostname)) return route;

  // Stay inside the pairing the visitor is already in. Mixing them is the same
  // cross-network bug this file was written to close, one pairing later.
  const origin = isPairedTestnetHost(hostname)
    ? TESTNET_ORIGINS_PAIRED[slug]
    : TESTNET_ORIGINS[slug];
  if (!origin) return route;

  try {
    const from = new URL(route);
    return `${origin}${from.pathname === '/' ? '' : from.pathname}${from.search}`;
  } catch {
    return route;
  }
};
