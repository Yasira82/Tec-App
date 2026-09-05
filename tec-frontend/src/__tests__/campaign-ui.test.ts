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
