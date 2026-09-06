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

  it('refuses "mark sent" unless the id LOOKS like a transaction hash', () => {
    // The rule used to be "not empty", and `1` passed it: a claim was marked
    // PAID and the claimant was told "Sent — 1 π on its way, check your Pi
    // wallet" while nothing had left any wallet. This field is the evidence
    // that the transfer happened; one that takes any characters is not
    // evidence, it is a checkbox with extra steps.
    expect(page).toContain('/^[0-9a-fA-F]{64}$/');
    expect(page).toMatch(/not a transaction hash/);
  });

  it('says that nothing here sends Pi', () => {
    // The platform holds no wallet. Somebody who assumes otherwise records a
    // payment that never happened and sends the claimant looking for it.
    expect(page).toMatch(/Send the Pi from your wallet first/);
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

describe('a mission actually records the visit', () => {
  const page = codeOf('app/hub/campaign/page.tsx');

  it('POSTs the open when a mission link is clicked', () => {
    // Regression: the missions were plain <a> links that recorded NOTHING. The
    // campaign reads the same PioneerQuest.opened_apps the Founding Quest
    // writes — so a pioneer could open all eight apps, stay at zero, and never
    // reach the claim form. A campaign whose missions cannot be completed is
    // worse than a closed one: it looks open.
    expect(page).toContain("fetch('/api/bff/pioneer/open'");
    expect(page).toMatch(/onClick=\{\(\) => onOpen\(slug\)\}/);
    expect(page).toMatch(/onOpen=\{recordOpen\}/);
  });

  it('uses keepalive, because the mission navigates away', () => {
    // A fetch in flight when the tab navigates is cancelled — the exact way the
    // Founding open was lost before.
    expect(page).toMatch(/keepalive:\s*true/);
  });

  it('sends the CSRF token', () => {
    expect(page).toContain('tec_csrf');
    expect(page).toContain('x-csrf-token');
  });

  it('re-reads progress when the pioneer comes back to the tab', () => {
    // Missions open in a new tab, so this page never unmounts and never
    // re-fetches: the ticks would stay empty until a manual reload, which reads
    // as "my visit did not count" exactly when it did.
    expect(page).toMatch(/addEventListener\('focus'/);
    expect(page).toMatch(/removeEventListener\('focus'/);
  });

  it('never ticks a mission optimistically', () => {
    // `connection` requires a message SENT, not a tab opened. A hopeful ✅ there
    // would be a lie the claim button then refuses to honour — the server stays
    // the only authority on what is done.
    expect(page).toMatch(/done=\{me\?\.done\.includes\(slug\) \?\? false\}/);
  });
});

describe('the Connection mission points at the TEC group', () => {
  const page = codeOf('app/hub/campaign/page.tsx');

  it('sends Connection to the invite link, not just to the app', () => {
    // The invite joins the pioneer in ONE tap with nobody to approve it. Saying
    // "send a message in the TEC group" without saying where the group is turns
    // a one-tap mission into a search.
    expect(page).toMatch(/slug !== 'connection'\) return linkFor\(slug\)/);
    expect(page).toContain('connection_invite_url');
    expect(page).toMatch(/href=\{hrefFor\(slug\)\}/);
  });

  it('falls back to the app when no invite is configured', () => {
    // A mission that sends someone to a broken URL is worse than one that sends
    // them to the app and lets them find the group.
    expect(page).toMatch(/me\?\.connection_invite_url \|\| status\?\.connection_invite_url \|\| linkFor\(slug\)/);
  });

  it('tells them what the link will do and what is still required', () => {
    expect(page).toMatch(/puts you in the TEC group/);
    expect(page).toMatch(/Opening the app is not enough/);
  });
});

describe('a mission remembers where the pioneer was', () => {
  const page = codeOf('app/hub/campaign/page.tsx');

  it('stashes /hub/campaign before the mission navigates away', () => {
    // Reported from a phone: leaving an app landed on the sign-in page rather
    // than back on the campaign. A mission goes to another tecosystem.app app,
    // which may bounce through the Hub's SSO to resolve its own session —
    // coming back walks into the middle of that chain. The Hub already knows
    // how to forward a remembered destination; nothing was telling it where the
    // person had been standing.
    expect(page).toMatch(/rememberReturn\('\/hub\/campaign'\)/);
    expect(page).toContain("from '@/lib-client/return-to'");
  });

  it('remembers BEFORE the record fetch, not after', () => {
    // The navigation can begin the moment the click is handled. A stash queued
    // behind a network call is a stash that may never happen.
    const code = page.slice(page.indexOf('const recordOpen'));
    expect(code.indexOf('rememberReturn')).toBeLessThan(code.indexOf('fetch('));
  });
});

describe('the payout queue is reachable from the campaign itself', () => {
  const page = codeOf('app/hub/campaign/page.tsx');

  it('shows an admin an entry point to /hub/admin/campaign', () => {
    // Reachable from Profile too, but a link there is a detour when you are
    // standing on this page wondering who has claimed.
    expect(page).toContain("/hub/admin/campaign");
    expect(page).toMatch(/isAdmin && \(/);
  });

  it('gates it on the role, and only shows it', () => {
    // The route and the service both check again, and they are the ones that
    // decide (P5) — this hides a button, it does not grant anything.
    expect(page).toMatch(/role\?: string \} \| null\)\?\.role === 'admin'/);
  });
});

describe('a rejected pioneer is offered another go', () => {
  const page = codeOf('app/hub/campaign/page.tsx');

  it('does not treat a REJECTED claim as an active one', () => {
    // The service was changed to allow a second claim after a rejection. This
    // page still gated the missions on ANY claim, so the rejected pioneer met
    // a dead end: the notice, and nothing to do about it.
    expect(page).toMatch(/claim\.status !== 'REJECTED' \? claim : null/);
    expect(page).toMatch(/!activeClaim && status\?\.open && \(/);
  });

  it('tells them what to DO, not just who to contact', () => {
    // "Contact us" alone, on a screen with no way forward, reads as a polite no.
    expect(page).toMatch(/try again below/i);
  });
});

describe('a claim keeps its record when the round ends', () => {
  const page = codeOf('app/hub/campaign/page.tsx');

  it('shows "no campaign" only to somebody with NO claim at all', () => {
    // Keying this on `activeClaim` hid a rejected pioneer's own notice the
    // moment the round closed — the record of what happened to them gone, with
    // nothing in its place. A regression from the fix one commit earlier.
    expect(page).toMatch(/!status\?\.open && !claim \?/);
  });

  it('offers the form only while a round is open', () => {
    // The missions come back for a rejected pioneer, but a closed campaign
    // would invite a claim the service refuses — and being refused twice reads
    // as being refused personally.
    expect(page).toMatch(/!activeClaim && status\?\.open && \(/);
  });
});
