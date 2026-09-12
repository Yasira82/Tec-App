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
  TESTNET_ORIGINS, TESTNET_ORIGINS_PAIRED, isHubTestnetHost, routeForNetwork,
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
  // cannot be derived from an app's name — three of these are NOT `tec-<slug>`.
  //
  // The sentence that used to live here — "every value was read from that app's
  // own ALLOWED_AUDIENCES" — named the WRONG authority, and the commerce entry
  // below is what it cost. An allowlist answers "may this host sign in?", never
  // "is this host ours?", and it happily lists a name we wanted but do not own.
  //
  // The authority is the Vercel project's **Domains** page, and nothing else.
  // Commerce's reads `tec-commerce-app.vercel.app`; the prefix-less spelling
  // this test used to assert belongs to a stranger's account.
  const ODD_ONES: Record<string, string> = {
    nbf:       'https://nbf-ivory.vercel.app',
    analytics: 'https://tec-analytics-app.vercel.app',
    assets:    'https://tec-assets-app.vercel.app',
  };

  it('keeps the hosts that are NOT tec-<slug>', () => {
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

// ── A host is read off the deployment, or it is not known ──────────────────
// These values were first built by taking the FIRST `*.vercel.app` entry in
// each app's own ALLOWED_AUDIENCES. That reads like the app is the authority —
// but an allowlist answers "may this host sign in?", not "is this host ours?".
//
// Zone lists BOTH `tec-zone.vercel.app` (the name it wanted, which Vercel had
// already given to a stranger) and `tec-zone-mu.vercel.app` (its deployment).
// First-entry picked the stranger, and the Zone tile on the Testnet Hub opened
// someone else's shop, which then 404'd. The tile was not broken — it was
// pointing off the platform.
describe('the recorded deployment hosts', () => {
  it('uses the suffixed host Vercel actually assigned, never the name we wanted', () => {
    // Recorded in audits/PI_TESTNET_GATE_FINDINGS_2026-09-06.md §8.
    expect(TESTNET_ORIGINS.zone).toBe('https://tec-zone-mu.vercel.app');
    expect(TESTNET_ORIGINS.elite).toBe('https://tec-elite-bvzb.vercel.app');
    // Commerce used to be cited HERE as the proof that no rule can be inferred
    // — "no `tec-` prefix at all". That claim was itself an inference, and the
    // Commerce project's Domains page says `tec-commerce-app.vercel.app`. The
    // example offered as evidence against guessing was a guess.
    expect(TESTNET_ORIGINS.commerce).toBe('https://tec-commerce-app.vercel.app');
  });

  it('never names a host we know belongs to someone else', () => {
    const strangers = [
      'https://tec-zone.vercel.app',
      'https://tec-elite.vercel.app',
      // Third one found, and the costliest: it was a live Testnet target AND
      // an SSO allowlist entry, so the Hub would hand it a signed session.
      'https://commerce-app.vercel.app',
    ];
    for (const s of strangers) {
      expect(Object.values(TESTNET_ORIGINS)).not.toContain(s);
    }
  });

  it('has a paired entry for every legacy slug, and no extra', () => {
    // A slug present in one map and missing from the other silently falls back
    // to the Mainnet route on one pairing only — which reads as "this tile is
    // fine" right up until it takes a Test-Pi visitor to a Mainnet payment.
    expect(Object.keys(TESTNET_ORIGINS_PAIRED).sort())
      .toEqual(Object.keys(TESTNET_ORIGINS).sort());
  });
});
