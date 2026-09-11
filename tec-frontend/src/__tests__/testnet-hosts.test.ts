//
// The Hub's app grid linked to the registry's MAINNET domains, always. So a tap
// from the TESTNET Hub opened the app's Mainnet host — and from there the app's
// own `hubPaymentOrigin` correctly resolved the Mainnet Hub, so the payment came
// back as a Mainnet payment with no testnet marker, approved with the Mainnet
// key, which a Test-Pi wallet can never pay.
//
// From the failing run (Vercel, 11 Sep): one tap on the Testnet Hub, and three
// hops later `POST /api/payment/create` is served by hub.tecosystem.app.
//
// The apps had already learned to find the right Hub. The Hub had never learned
// to find the right apps.
import { describe, it, expect } from 'vitest';
import {
  TESTNET_ORIGINS, isHubTestnetHost, routeForNetwork,
} from '@/domains/testnet-hosts';
import { LIVE_DOMAINS } from '@/domains/_registry';

describe('routeForNetwork', () => {
  const MAINNET = 'hub.tecosystem.app';
  const TESTNET = 'tec-app-frontend.vercel.app';

  it('swaps the origin on the Testnet Hub and KEEPS the path', () => {
    // The path is the app's own routing and has nothing to do with the network.
    expect(routeForNetwork('https://system.tecosystem.app/app', 'system', TESTNET))
      .toBe('https://tec-system.vercel.app/app');
    expect(routeForNetwork('https://ecommerce.tecosystem.app/shop', 'ecommerce', TESTNET))
      .toBe('https://tec-ecommerce.vercel.app/shop');
  });

  it('leaves the Mainnet Hub completely untouched', () => {
    // This function must not be able to move a real buyer anywhere new.
    for (const [slug, o] of Object.entries(TESTNET_ORIGINS)) {
      const route = `https://${slug}.tecosystem.app/app`;
      expect(routeForNetwork(route, slug, MAINNET)).toBe(route);
      expect(o).toMatch(/^https:\/\/[a-z0-9.-]+\.vercel\.app$/);
    }
  });

  it('never invents a host — an unknown slug keeps its Mainnet route', () => {
    // Guessing `tec-<slug>.vercel.app` would be wrong for four apps already
    // (commerce-app, nbf-ivory, tec-analytics-app, tec-assets-app), and a
    // guessed host is a 404 on a tile the user trusted.
    expect(routeForNetwork('https://newapp.tecosystem.app/app', 'newapp', TESTNET))
      .toBe('https://newapp.tecosystem.app/app');
  });

  it('leaves the Hub\'s own relative routes alone', () => {
    expect(routeForNetwork('/hub', 'tec', TESTNET)).toBe('/hub');
    expect(routeForNetwork('/kyc', 'kyc', TESTNET)).toBe('/kyc');
  });

  it('recognises the Hub\'s own host, and is not fooled by a look-alike', () => {
    expect(isHubTestnetHost(TESTNET)).toBe(true);
    expect(isHubTestnetHost('tec-app-frontend.vercel.app:443')).toBe(true);
    expect(isHubTestnetHost(MAINNET)).toBe(false);
    expect(isHubTestnetHost('vercel.app.attacker.com')).toBe(false);
    expect(isHubTestnetHost(undefined)).toBe(false);
  });
});

describe('the map agrees with what each app declares about itself', () => {
  // Not a style check. Vercel project names are claimed first-come, so a host
  // cannot be derived from an app's name — four of these are NOT `tec-<slug>`.
  // Every value here was read from that app's own ALLOWED_AUDIENCES, which is
  // the list its SSO landing will actually accept; a value that drifts from it
  // sends the visitor somewhere the app itself will reject.
  const ODD_ONES: Record<string, string> = {
    commerce:  'https://commerce-app.vercel.app',
    nbf:       'https://nbf-ivory.vercel.app',
    analytics: 'https://tec-analytics-app.vercel.app',
    assets:    'https://tec-assets-app.vercel.app',
  };

  it('keeps the four hosts that are NOT tec-<slug>', () => {
    for (const [slug, origin] of Object.entries(ODD_ONES)) {
      expect(TESTNET_ORIGINS[slug]).toBe(origin);
    }
  });

  it('covers every live external app in the registry', () => {
    // A missing slug is not a crash — it keeps its Mainnet route — but on the
    // Testnet Hub that silently crosses the networks again, which is the whole
    // bug. So the gap is made visible here rather than discovered in a payment.
    const missing = LIVE_DOMAINS
      .filter(d => d.layer !== 'os')
      .filter(d => (d.route ?? '').startsWith('http'))
      .filter(d => !TESTNET_ORIGINS[d.slug])
      .map(d => d.slug);
    expect(missing).toEqual([]);
  });

  it('maps each slug to a distinct host', () => {
    const origins = Object.values(TESTNET_ORIGINS);
    expect(new Set(origins).size).toBe(origins.length);
  });
});

describe('both launchers use the rule', () => {
  const read = (p: string) =>
    require('node:fs').readFileSync(require('node:path').join(process.cwd(), p), 'utf8');

  it('the Hub grid and the Dashboard grid both route by network', () => {
    // They render the identical launcher from the identical registry. One of
    // them keeping the old line would leave a second door onto the wrong
    // network, and it would be found the same way this one was: in a log,
    // three hops later.
    for (const f of ['src/app/hub/page.tsx', 'src/app/dashboard/page.tsx']) {
      const src = read(f);
      expect(src).toContain('routeForNetwork(');
      expect(src).not.toMatch(/const route\s*=\s*d\.route \?\? `\/\$\{d\.slug\}`;/);
    }
  });
});
