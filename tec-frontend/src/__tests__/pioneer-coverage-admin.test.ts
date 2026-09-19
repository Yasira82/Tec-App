/**
 * The screen that says which apps still cannot claim their domain.
 *
 * Pi refuses a `.pi` claim until the connected app has "at least 5 unique KYC'd
 * approved Pioneers engage with it". Twenty-four domains were won at auction;
 * only `tec.pi` has been accepted. This is the list that turns the campaign
 * from guesswork into a queue.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8');
/** Comments stripped — these assertions are about what the code DOES. */
const codeOf = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the coverage route forwards the user, not a service credential', () => {
  const route = codeOf('app/api/admin/pioneers/coverage/route.ts');

  it('never attaches x-internal-key', () => {
    // identity-service reads that header as a ServiceActor credential and skips
    // the role check — attaching it would hand an app-by-app map of where the
    // platform is thinnest to any signed-in visitor who found the URL.
    expect(route).not.toContain('x-internal-key');
    expect(route).not.toContain('INTERNAL_SECRET');
  });

  it('sends the session token as the only authority', () => {
    expect(route).toMatch(/Authorization: `Bearer \$\{token\}`/);
  });

  it('refuses before calling the gateway when there is no token', () => {
    expect(route).toMatch(/if \(!token\) return NextResponse\.json\(\s*\{ error: 'Unauthorized' \}/);
  });

  it('passes the service’s status through instead of flattening it', () => {
    // A 403 must REACH the page, or the screen cannot tell "you may not" apart
    // from "nothing to show".
    expect(route).toMatch(/status: res\.status/);
  });

  it('does not cache — a stale coverage number is a wrong decision', () => {
    expect(route).toContain("cache:   'no-store'");
  });
});

describe('the page', () => {
  const page = codeOf('app/hub/admin/pioneers/page.tsx');

  it('hides itself from non-admins', () => {
    expect(page).toContain("?.role === 'admin'");
    expect(page).toContain('Access restricted');
  });

  it('treats 401 and 403 as denial, not as an error', () => {
    expect(page).toMatch(/res\.status === 401 \|\| res\.status === 403/);
  });

  it('shows the ARRIVED count as the headline, openers as context', () => {
    // Was `verified`. That number reads TEC's own document-KYC — a register Pi
    // does not consult and almost nobody completes — so it could never move,
    // and neither could any total derived from it. `arrived` is confirmed by
    // the app itself: a superset of what Pi counts, and the closest thing to it
    // this platform can actually measure.
    expect(page).toMatch(/\{arrived\} \/ \{row\.threshold\}/);
    expect(page).toMatch(/\{row\.openers\} opened/);
  });

  it('renders the service’s caveat WITH the numbers', () => {
    // A reader who mistakes this count for Pi's verdict will declare a domain
    // ready and then watch the claim get refused. The warning has to travel
    // with the data, not sit in a doc nobody opens.
    expect(page).toContain('data.note');
  });

  it('does not invent its own threshold', () => {
    // Pi owns that number. A literal 5 here would drift the day Pi changes it.
    expect(page).toContain('row.threshold');
    expect(page).not.toMatch(/of=\{5\}|threshold\s*=\s*5/);
  });
});
