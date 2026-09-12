// Every host in this Hub is a host WE OWN — not one whose name fits.
//
// `TESTNET_ORIGINS.commerce` was `https://commerce-app.vercel.app`. The
// Commerce Vercel project's Domains page reads `tec-commerce-app.vercel.app`.
// The value without the prefix belongs to somebody else's account.
//
// So the Testnet grid handed every visitor to a stranger's deployment. It
// looked alive — the favicon loaded — and answered 500 for every function,
// which is what sent three rounds of debugging into this app's code, into its
// Railway service, and into a Node-version theory, before anyone read the
// Domains page.
//
// The same mistake, twice: Zone once pointed at `tec-zone.vercel.app`, a host
// a stranger had claimed, and that one rendered a pink shop.
//
// And it was WRITTEN DOWN as verified. The file's own header cited
// `commerce-app` as the proof that a host cannot be inferred from a name —
// while being an inference itself. A comment claiming "not invented" beside an
// invented value is worse than silence: it is what a reader checks instead of
// checking the source.
//
// The security half is sharper than the routing half. `/api/auth/sso` signs a
// token carrying the user's ACCESS TOKEN and redirects to the target. An
// allowlist entry is not a hint about where an app might live — it is
// permission to hand that origin a session.
import { describe, it, expect } from 'vitest';
import { TESTNET_ORIGINS, TESTNET_ORIGINS_PAIRED } from '@/domains/testnet-hosts';
import { ALLOWED_APP_ORIGINS } from '@/domains/allowed-origins';

/**
 * Hosts proven NOT to be ours, by reading the Vercel project's Domains page.
 * Add to this list only with that evidence — never from a name or a guess.
 */
const NOT_OURS = [
  'https://commerce-app.vercel.app',
];

describe('a host we do not own is never referenced', () => {
  it.each(NOT_OURS)('%s is not a Testnet target', (host) => {
    expect(Object.values(TESTNET_ORIGINS)).not.toContain(host);
    expect(Object.values(TESTNET_ORIGINS_PAIRED)).not.toContain(host);
  });

  it.each(NOT_OURS)('%s is not in the SSO allowlist', (host) => {
    // The expensive direction. A target here receives a signed token carrying
    // the user's access token — a stranger's origin in this list is a session
    // handed to whoever controls it.
    expect(ALLOWED_APP_ORIGINS).not.toContain(host);
  });
});

describe('Commerce points at the host its Vercel project actually serves', () => {
  it('uses the tec- prefixed host', () => {
    expect(TESTNET_ORIGINS.commerce).toBe('https://tec-commerce-app.vercel.app');
  });

  it('and that host is allowlisted, or the handoff 400s', () => {
    // Routing and permission are two lists that must agree. A Testnet target
    // the allowlist rejects produces `invalid_target` — a different failure
    // from the one just fixed, and just as confusing.
    expect(ALLOWED_APP_ORIGINS).toContain(TESTNET_ORIGINS.commerce);
  });
});

describe('every Testnet target is allowlisted', () => {
  // Not Commerce-specific: any entry that drifts out of the allowlist breaks
  // that app's tile with a 400 the grid gives no hint about.
  it.each(Object.entries(TESTNET_ORIGINS))('%s -> %s', (_slug, origin) => {
    expect(ALLOWED_APP_ORIGINS).toContain(origin);
  });
});

describe('the header no longer cites the wrong value as proof', () => {
  const src = require('node:fs').readFileSync(
    require('node:path').join(process.cwd(), 'src/domains/testnet-hosts.ts'), 'utf8') as string;

  it('does not present `commerce-app` as an example of a verified host', () => {
    expect(src).not.toMatch(/`commerce-app` has no `tec-` prefix/);
  });

  it('names the one source a value may come from', () => {
    // The actual fix for this class: not a better guess, a stated source.
    expect(src).toMatch(/Domains/);
  });
});
