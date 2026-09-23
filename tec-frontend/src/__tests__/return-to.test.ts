import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  rememberReturn, takeReturn, clearReturn,
  returnsThroughHub, stageOnward, takeOnward,
} from '@/lib-client/return-to';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The bug: a guard bounced an unresolved session with `router.push('/')`, which
// is right about the destination and wrong about everything else — the person
// signs in again and lands on the marketing page instead of the screen they
// were already on.

beforeEach(() => { sessionStorage.clear(); vi.useRealTimers(); });

describe('it brings you back to where you were', () => {
  it('remembers a path and returns it', () => {
    rememberReturn('/dashboard/wallet');
    expect(takeReturn()).toBe('/dashboard/wallet');
  });

  it('is ONE-SHOT — a second read is empty', () => {
    // A value that survives its use would send someone back to the same screen
    // on a later, unrelated sign-in, and they would have no idea why.
    rememberReturn('/dashboard/kyc');
    expect(takeReturn()).toBe('/dashboard/kyc');
    expect(takeReturn()).toBeNull();
  });

  it('returns null when nothing was remembered', () => {
    expect(takeReturn()).toBeNull();
  });

  it('does not remember the landing page itself', () => {
    // Remembering "/" makes the return a no-op that still costs a navigation.
    rememberReturn('/');
    expect(takeReturn()).toBeNull();
  });
});

describe('a stored value is INPUT, not something we trust', () => {
  it('refuses a protocol-relative URL', () => {
    // `//evil.com` starts with "/" and browsers treat it as EXTERNAL — which is
    // why a bare startsWith('/') is not enough on its own. This is the same
    // open-redirect class sso-callback already guards against.
    rememberReturn('//evil.com');
    expect(takeReturn()).toBeNull();
  });

  it('refuses an absolute URL', () => {
    rememberReturn('https://evil.com/steal');
    expect(takeReturn()).toBeNull();
  });

  it('refuses a backslash-escaped path', () => {
    rememberReturn('/\\evil.com');
    expect(takeReturn()).toBeNull();
  });

  it('re-validates on the way OUT, not only on the way in', () => {
    // Storage is a convenience, not a trust boundary — anything already in it
    // (from an older build, or a devtools paste) has to fail the same check.
    sessionStorage.setItem('__tec_return_to', 'https://evil.com');
    expect(takeReturn()).toBeNull();
  });

  it('refuses an absurdly long path', () => {
    rememberReturn('/' + 'a'.repeat(600));
    expect(takeReturn()).toBeNull();
  });

  it('refuses a non-string', () => {
    rememberReturn(undefined as unknown as string);
    expect(takeReturn()).toBeNull();
  });
});

describe('storage refusing does not break the app', () => {
  it('survives a throwing sessionStorage', () => {
    // Private mode, blocked site data, a browser that simply refuses. The user
    // lands on the default destination — degraded, never broken.
    // Replacing the GLOBAL, not spying on Storage.prototype: jsdom does not
    // route sessionStorage through that prototype, so a prototype spy silently
    // does nothing and the test passes while proving nothing. Caught by writing
    // the assertion first and watching it fail for the wrong reason.
    const throwing = {
      getItem:    () => { throw new Error('blocked'); },
      setItem:    () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    vi.stubGlobal('sessionStorage', throwing);
    expect(() => rememberReturn('/dashboard')).not.toThrow();
    expect(takeReturn()).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe('a destination belongs to ONE trip', () => {
  it('expires — an old tap does not steer a later back press', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T10:00:00Z'));
    rememberReturn('/hub/campaign');
    vi.setSystemTime(new Date('2026-09-23T10:31:00Z'));
    expect(takeReturn()).toBeNull();
  });

  it('is still good within the window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T10:00:00Z'));
    rememberReturn('/pioneers');
    vi.setSystemTime(new Date('2026-09-23T10:20:00Z'));
    expect(takeReturn()).toBe('/pioneers');
  });

  it('reads a value with no timestamp (an older build) as expired', () => {
    sessionStorage.setItem('__tec_return_to', '/hub/campaign');
    expect(takeReturn()).toBeNull();
  });

  it('clearReturn forgets it', () => {
    rememberReturn('/hub/campaign');
    clearReturn();
    expect(takeReturn()).toBeNull();
  });
});

describe('the Quest and the campaign come back THROUGH the Hub', () => {
  it('knows which pages sit under the Hub', () => {
    expect(returnsThroughHub('/pioneers')).toBe(true);
    expect(returnsThroughHub('/hub/campaign')).toBe(true);
    expect(returnsThroughHub('/dashboard/wallet')).toBe(false);
    expect(returnsThroughHub('/hub')).toBe(false);
  });

  it('the onward hop is one-shot', () => {
    stageOnward('/pioneers');
    expect(takeOnward()).toBe('/pioneers');
    expect(takeOnward()).toBeNull();
  });

  it('the onward hop is short-lived — only the very next Hub load may take it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T10:00:00Z'));
    stageOnward('/pioneers');
    vi.setSystemTime(new Date('2026-09-23T10:02:00Z'));
    expect(takeOnward()).toBeNull();
  });

  it('refuses to stage anything that is not a Hub child', () => {
    stageOnward('https://evil.com');
    stageOnward('/dashboard');
    expect(takeOnward()).toBeNull();
    sessionStorage.setItem('__tec_return_onward', `//evil.com|${Date.now()}`);
    expect(takeOnward()).toBeNull();
  });

  it('the whole trip: Quest → app → back → Quest → back → Hub', () => {
    // Tap on the Quest.
    rememberReturn('/pioneers');
    // Back from the app surfaces on the landing page, which does this:
    const back = takeReturn();
    expect(back).toBe('/pioneers');
    stageOnward(back!);             // …and router.replace('/hub')
    // The Hub loads, clears, and pushes the Quest on top of itself.
    clearReturn();
    expect(takeOnward()).toBe('/pioneers');
    // Back from the Quest pops to the Hub, which loads again — and stays.
    clearReturn();
    expect(takeOnward()).toBeNull();
    // A later visit to the landing page is not forwarded anywhere.
    expect(takeReturn()).toBeNull();
  });
});

describe('every Hub surface forgets a finished trip', () => {
  const src = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8');

  it.each([
    'app/pioneers/PioneersClient.tsx',
    'app/hub/campaign/page.tsx',
    'app/hub/page.tsx',
  ])('%s calls clearReturn', (file) => {
    expect(src(file)).toMatch(/clearReturn\(\)/);
  });

  it('the Hub PUSHES the onward page — a replace would drop the Hub from history', () => {
    const hub = src('app/hub/page.tsx');
    expect(hub).toMatch(/takeOnward\(\)/);
    expect(hub).toMatch(/router\.push\(onward\)/);
  });
});
