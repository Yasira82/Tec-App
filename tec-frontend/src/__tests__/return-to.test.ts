import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rememberReturn, takeReturn } from '@/lib-client/return-to';

// The bug: a guard bounced an unresolved session with `router.push('/')`, which
// is right about the destination and wrong about everything else — the person
// signs in again and lands on the marketing page instead of the screen they
// were already on.

beforeEach(() => sessionStorage.clear());

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
