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
 * NOT invented, and not derived from a name. Each is the FIRST `*.vercel.app`
 * entry in that app's own `ALLOWED_AUDIENCES` — the app is the authority on its
 * own hosts, and that list is what its SSO landing will actually accept. The
 * rule is one rule with no special cases, which matters because Vercel project
 * names are claimed first-come and three of these are NOT `tec-<slug>`:
 * `commerce-app`, `nbf-ivory`, `tec-analytics-app`, `tec-assets-app`.
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
  elite:      'https://tec-elite.vercel.app',
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
  zone:       'https://tec-zone.vercel.app',
};

/** `*.vercel.app` is the Hub's own paired Testnet host; a custom domain is Mainnet. */
export const isHubTestnetHost = (host?: string | null): boolean =>
  /\.vercel\.app$/i.test((host ?? '').split(':')[0]?.trim() ?? '');

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
  const onTestnetHub = isHubTestnetHost(
    host ?? (typeof window === 'undefined' ? null : window.location.hostname),
  );
  if (!onTestnetHub) return route;

  const origin = TESTNET_ORIGINS[slug];
  if (!origin) return route;

  try {
    const from = new URL(route);
    return `${origin}${from.pathname === '/' ? '' : from.pathname}${from.search}`;
  } catch {
    return route;
  }
};
