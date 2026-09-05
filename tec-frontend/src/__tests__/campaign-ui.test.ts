/**
 * The campaign surfaces — the claim form and the payout queue.
 *
 * Real Pi moves at the end of this flow, sent by hand to an address a person
 * typed. Every assertion here guards one of the three ways that goes wrong:
 * the wrong header on an admin route, a phishing-shaped form, or a screen that
 * implies an instant payout that will not come.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read   = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8');
/** Comments stripped — these assertions are about what the code DOES. */
const codeOf = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the admin payout route forwards the user, not a service credential', () => {
  const route = codeOf('app/api/admin/campaign/claims/route.ts');

  it('never attaches x-internal-key', () => {
    // This list carries every claimant's wallet address. identity-service reads
    // that header as a ServiceActor credential and skips the role check.
    expect(route).not.toContain('x-internal-key');
    expect(route).not.toContain('INTERNAL_SECRET');
  });

  it('refuses before calling the gateway when there is no token', () => {
    expect(route).toMatch(/if \(!token\) return NextResponse\.json\(\s*\{ error: 'Unauthorized' \}/);
  });

  it('passes the service’s status through', () => {
    expect(route).toMatch(/status: res\.status/);
  });

  it('only ever sends the two actions it knows', () => {
    // An action taken from the body unchecked would let a caller reach any
    // path segment under the claim.
    expect(route).toMatch(/body\?\.action === 'reject' \? 'reject' : 'paid'/);
  });
});

describe('the claim route does not decide who gets paid', () => {
  const route = codeOf('app/api/bff/campaign/claim/route.ts');

  it('sends ONLY the address — never an owner', () => {
    // The service derives the owner from the verified token. A route that
    // decides who receives Pi is the last place to let the caller say.
    expect(route).toMatch(/JSON\.stringify\(\{ wallet_address: input\.wallet_address \}\)/);
    expect(route).not.toMatch(/owner|username|pi_uid/);
  });

  it('requires auth', () => {
    expect(route).toContain('requireAuth: true');
  });

  it('carries the service’s own message on failure', () => {
    // The service knows WHICH way an address was wrong, and which app is still
    // missing. A generic failure hides the only line a person can act on.
    expect(route).toMatch(/data\?\.message \?\? data\?\.error/);
  });
});

describe('an unreadable campaign is CLOSED, never open', () => {
  const route = codeOf('app/api/bff/campaign/status/route.ts');

  it('falls back to open:false when the gateway cannot be reached', () => {
    // The page must not invite someone to earn Pi it cannot confirm is still
    // on offer (P6).
    expect(route).toMatch(/data: \{ open: false \}/);
  });
});

describe('the claim form is not shaped like a phishing page', () => {
  const page = read('app/hub/campaign/page.tsx');

  it('says we will NEVER ask for a passphrase, before the field', () => {
    // "Send us your wallet address" is a shape people are phished with. The
    // only defence is to say, before they type, what we will never ask for.
    const warning = page.indexOf('never');
    const input   = page.indexOf('<input');
    expect(warning).toBeGreaterThan(-1);
    expect(warning).toBeLessThan(input);
    expect(page).toMatch(/passphrase or secret key/);
  });

  it('asks for the PUBLIC address by name', () => {
    expect(page).toMatch(/public address/);
    expect(page).toMatch(/starts with/);
  });

  it('never mentions a payment to qualify', () => {
    expect(page).toMatch(/there is no payment at any step/);
  });
});

describe('the wait is stated, not implied away', () => {
  const page = read('app/hub/campaign/page.tsx');

  it('tells a claimant a person sends it by hand', () => {
    // A screen implying an instant payout turns a normal wait into a suspicion
    // that they have been cheated.
    expect(page).toMatch(/A person sends the Pi by hand, so this is not instant/);
  });

  it('promises the transaction id as the proof', () => {
    expect(page).toMatch(/transaction id here when it is done/);
  });
});

describe('the payout queue is built for copying by hand', () => {
  const page = read('app/hub/admin/campaign/page.tsx');

  it('renders the address monospaced with a copy button', () => {
    // It is retyped into a wallet app by a human; a mis-copied character sends
    // real Pi to a stranger with no way back.
    expect(page).toMatch(/font-mono/);
    expect(page).toMatch(/navigator\.clipboard\.writeText\(claim\.wallet_address\)/);
  });

  it('refuses "mark sent" without a transaction id, and says why', () => {
    expect(page).toMatch(/a payment without one is not a record/);
  });

  it('hides itself from non-admins', () => {
    expect(page).toContain("?.role === 'admin'");
    expect(page).toContain('Access restricted');
  });
});

// ── The Hub spotlight ───────────────────────────────────────────────────────

describe('the carousel slide appears only while a round is open', () => {
  const carousel = codeOf('components/hub/HubCarousel.tsx');
  const hub      = codeOf('app/hub/page.tsx');

  it('renders the campaign slide conditionally', () => {
    // A slide advertising a campaign that has ended is a dead promise on the
    // Hub's most prominent surface.
    expect(carousel).toMatch(/const showCampaign = campaignOpen && typeof goToCampaign === 'function'/);
    expect(carousel).toMatch(/\{showCampaign && \(/);
  });

  it('moves the slide COUNT with it', () => {
    // The count used to be the constant 3. A stale count either lets a swipe
    // land on a slide that is not there, or makes the last one unreachable —
    // both look like a broken carousel rather than a finished campaign.
    expect(carousel).toMatch(/const SLIDES = showCampaign \? 4 : 3/);
    expect(carousel).not.toMatch(/^const SLIDES = 3;$/m);
  });

  it('CLAMPS the index, because the count can shrink under a viewer', () => {
    // A round ends while someone is parked on the last slide; an unclamped
    // index then points past the track and the spotlight goes blank.
    expect(carousel).toMatch(/const idx = Math\.min\(Math\.max\(carouselIdx, 0\), SLIDES - 1\)/);
    expect(carousel).toMatch(/translateX\(\$\{rtl \? '' : '-'\}\$\{idx \* 100\}%\)/);
  });

  it('uses the clamped index for the dots too', () => {
    // Otherwise the track and its indicator disagree about where you are.
    expect(carousel).not.toMatch(/carouselIdx === i/);
    expect(carousel).toMatch(/idx === i/);
  });

  it('the Hub treats an unreadable status as CLOSED', () => {
    // The Hub must not headline Pi it cannot confirm is on offer (P6).
    expect(hub).toMatch(/setCampaignOpen\(j\?\.data\?\.open === true\)/);
    expect(hub).toMatch(/useState\(false\)/);
  });

  it('does not leave a setState behind after unmount', () => {
    expect(hub).toMatch(/let alive = true;[\s\S]*?return \(\) => \{ alive = false; \};/);
  });
});

describe('the status request stays out of the payment path', () => {
  const hub = codeOf('app/hub/page.tsx');

  it('is skipped during a Hub payment', () => {
    // `/hub?pay=1&…` renders PaymentPreparing and then the modal — the carousel
    // never appears, so the request is pure waste on the one screen where an
    // extra round trip is most expensive. It also stopped three payment-flow
    // tests passing, which is how it was noticed.
    expect(hub).toMatch(/get\('pay'\) === '1'\) return;/);
  });

  it('declares its hooks ABOVE the early returns', () => {
    // Two early returns sit lower in this component (HubSkeleton and
    // PaymentPreparing). A hook below them is called conditionally, and React
    // fails the whole page with "Rendered fewer hooks than expected".
    const hookAt   = hub.indexOf('setCampaignOpen');
    const firstRet = hub.indexOf('return <HubSkeleton />');
    expect(hookAt).toBeGreaterThan(-1);
    expect(firstRet).toBeGreaterThan(-1);
    expect(hookAt).toBeLessThan(firstRet);
  });
});
