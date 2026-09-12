// @vitest-environment node
//
// The app could not pay anybody, and nothing said so until it tried.
//
// The first real A2U payout round (2026-09-12) failed for every recipient with
// the same answer from Pi:
//
//     401  missing_scope
//     User hasn't authorized "wallet_address" scope
//
// The payout wallet, the API key and the network were all correct. The app had
// simply never asked its users for permission to learn their wallet address,
// so Pi had nowhere to send to.
//
// That is not only the Pi Portal's five-wallet gate. The Hub's home screen
// advertises a reward campaign — "claim real Pi" — paid through the same A2U
// path. It could never have paid a single person, on Mainnet either.
//
// The second half of the fix is that the scope list is now ONE constant. Two
// call sites authenticate, and they are coupled: login calls
// `piSession.markAuthenticated()` so the first Pay tap does not authenticate
// again, on the stated grounds that the scopes match. Two lists that must be
// identical, maintained separately, is how the next scope goes missing.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PI_SCOPES, piScopes } from '@/lib-client/pi/scopes';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('the scopes the app asks Pi for', () => {
  it('includes wallet_address — without it NOTHING can be paid out', () => {
    // Spelled exactly as Pi's own refusal spells it.
    expect(PI_SCOPES).toContain('wallet_address');
  });

  it('still includes the two it always had', () => {
    // Narrowing here would break login (username) or payment (payments). The
    // point of the change was to WIDEN by one, not to rewrite the set.
    expect(PI_SCOPES).toContain('username');
    expect(PI_SCOPES).toContain('payments');
  });

  it('hands the SDK a fresh array each time', () => {
    // `Pi.authenticate` is someone else's code. Giving it the module's own
    // array means a sort or a splice in there silently edits every later call.
    const a = piScopes();
    const b = piScopes();
    expect(a).toEqual([...PI_SCOPES]);
    expect(a).not.toBe(b);
    a.pop();
    expect(piScopes()).toEqual([...PI_SCOPES]);
  });
});

describe('every authenticate call site uses that one list', () => {
  const sites = {
    'pi-auth.ts (login)':      'src/lib-client/pi/pi-auth.ts',
    'pi-session.ts (payment)': 'src/lib-client/pi/pi-session.ts',
    'PiTestClient.tsx':        'src/app/pi-test/PiTestClient.tsx',
  };

  it.each(Object.entries(sites))('%s calls authenticate with piScopes()', (_name, path) => {
    const src = read(path);
    expect(src).toMatch(/authenticate\(\s*piScopes\(\)/);
  });

  it.each(Object.entries(sites))('%s has no hand-written scope array left', (_name, path) => {
    // A literal here is the regression: it would keep working, and it would
    // stop matching the day the list changes again.
    expect(read(path)).not.toMatch(/authenticate\(\s*\[\s*['"]username['"]/);
  });
});
