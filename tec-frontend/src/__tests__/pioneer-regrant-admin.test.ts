/**
 * The control that repairs a Founding gift, and the reason it had to exist here.
 *
 * `regrantFoundingGifts` shipped in `tec-identity-service` with no caller. The
 * campaign is worked from a phone, so a recovery reachable only by composing a
 * POST with an admin JWT by hand was a repair nobody could run — which is the
 * same as not having one.
 *
 * Source-level assertions, like its sibling `pioneer-coverage-admin`: what is
 * being pinned is *which credential goes downstream* and *which number leads*,
 * and a render test passes just as happily when the page shows the right label
 * over the wrong field.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8');
/** Comments stripped — these assertions are about what the code DOES. */
const codeOf = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the regrant route forwards the user, not a service credential', () => {
  const route = codeOf('app/api/admin/pioneers/regrant/route.ts');

  it('never attaches x-internal-key', () => {
    // identity-service reads that header as a ServiceActor credential and skips
    // the role check. On the READ route that would leak a weakness map; here it
    // would let any signed-in visitor who found the URL trigger a grant pass
    // across every Founding Pioneer. Same rule, higher stakes.
    expect(route).not.toContain('x-internal-key');
    expect(route).not.toContain('INTERNAL_SECRET');
  });

  it('sends the session token as the only authority', () => {
    expect(route).toMatch(/Authorization: `Bearer \$\{token\}`/);
  });

  it('refuses before calling the gateway when there is no token', () => {
    expect(route).toMatch(/if \(!token\) return NextResponse\.json\(\s*\{ error: 'Unauthorized' \}/);
  });

  it('is a POST, and reaches the POST route on the service', () => {
    // A GET here would be prefetchable and reachable from a link — an unusual
    // way to write subscriptions.
    expect(route).toMatch(/export async function POST/);
    expect(route).not.toMatch(/export async function GET/);
    expect(route).toMatch(/method:\s+'POST'/);
    expect(route).toContain('/api/identity/pioneer/regrant');
  });

  it('passes the service’s status through instead of flattening it', () => {
    expect(route).toMatch(/status: res\.status/);
  });
});

describe('the page reports the repair honestly', () => {
  const page = codeOf('app/hub/admin/pioneers/page.tsx');

  it('leads on `granted` — the count of gifts that had been LOST', () => {
    // The whole reason the service asks commerce instead of reading a flag of
    // its own. `already` will be nearly everything and says nothing happened;
    // `granted` is the one that says an outage cost somebody six months of PRO.
    expect(page).toMatch(/regrant\.granted > 0/);
    expect(page).toMatch(/recovered/);
  });

  it('says zero recovered is the GOOD answer, not an empty result', () => {
    expect(page).toContain('Nothing was missing');
  });

  it('keeps `already` and `by_lookup` distinguishable from a recovery', () => {
    // An id inferred from a username is a fair risk for a gift and not the same
    // fact as a recorded one, so it must not be folded into the total.
    expect(page).toMatch(/regrant\.already/);
    expect(page).toMatch(/regrant\.by_lookup/);
  });

  it('names the pioneers it could not resolve', () => {
    // A recovery that hides what it could not recover is not a recovery — and
    // these are precisely the rows that still need a human.
    expect(page).toMatch(/regrant\.unresolvable/);
  });

  it('surfaces a failure count rather than rounding it away', () => {
    expect(page).toMatch(/regrant\.failed/);
  });

  it('does not run on load — it writes', () => {
    // The effect belongs to `load` (the coverage read) and nothing else. An
    // admin opening the screen to look at numbers must not fire a fleet-wide
    // grant pass by arriving.
    expect(page).toMatch(/useEffect\(\(\) => \{ if \(!authLoading\) void load\(\); \}/);
    expect(page).not.toMatch(/void runRegrant\(\);?\s*\}, \[/);
    expect(page).toMatch(/onClick=\{\(\) => void runRegrant\(\)\}/);
  });

  it('cannot be double-fired while it is running', () => {
    // It walks every pioneer sequentially and calls commerce for each. A second
    // pass launched over the first is how a recovery becomes the next outage.
    expect(page).toMatch(/disabled=\{regranting\}/);
  });

  it('sends the CSRF token — `/api/admin` is in the protected list', () => {
    // The Origin branch would also let it through, but that is middleware's
    // FALLBACK. Every other state-changing call in this app carries the token,
    // and a route that quietly depends on the weaker branch is one header
    // change away from a 403 nobody can explain.
    expect(page).toMatch(/'x-csrf-token': decodeURIComponent\(csrf\)/);
    expect(page).toMatch(/tec_csrf=/);
  });

  it('clears the previous result before starting', () => {
    // A stale "3 recovered" left on screen under a fresh run reads as this
    // run's answer.
    expect(page).toMatch(/setRegrant\(null\)/);
  });
});
