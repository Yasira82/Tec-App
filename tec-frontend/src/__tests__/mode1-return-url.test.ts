// Where the Hub sends a Mode-1 payer back.
//
// Reported: "Cancel takes me to the Hub — but I was in the app." True, and it
// was the Hub guessing: an app that sends no `return_url` got the Hub's own
// /hub as the destination. The app must say where home is (fixed in the apps);
// the Hub must refuse to be told somewhere it may not go.
//
// That second half is the security one. This URL is navigated to, and on
// success it carries `payment_id` and `txid` — so an unchecked `return_url` is
// an open redirect that hands those identifiers to whatever origin the link
// named. `/hub?pay=1&amount=1&return_url=https://evil.example` was enough.
import { describe, it, expect } from 'vitest';
import { isAllowedAppUrl, ALLOWED_APP_ORIGINS } from '@/domains/allowed-origins';

describe('the Mode-1 return allowlist', () => {
  it('accepts a real TEC app origin', () => {
    expect(isAllowedAppUrl('https://tec-system.vercel.app/app')).toBe(true);
    expect(isAllowedAppUrl('https://system.tecosystem.app/app?x=1')).toBe(true);
    expect(isAllowedAppUrl('https://hub.tecosystem.app/hub')).toBe(true);
  });

  it('refuses an unknown origin', () => {
    expect(isAllowedAppUrl('https://evil.example/steal')).toBe(false);
  });

  it('refuses a look-alike that merely STARTS with an allowed origin', () => {
    // A prefix match on the whole URL would accept this — the classic way an
    // allowlist fails open. The SSO route used one until 2026-09-26; it now
    // matches the origin exactly, through this function.
    expect(isAllowedAppUrl('https://hub.tecosystem.app.evil.example/x')).toBe(false);
    expect(isAllowedAppUrl('https://tec-system.vercel.app.evil.example')).toBe(false);
  });

  it('refuses a non-https scheme on an allowed host', () => {
    expect(isAllowedAppUrl('http://hub.tecosystem.app/hub')).toBe(false);
    expect(isAllowedAppUrl('javascript:alert(1)')).toBe(false);
  });

  it('fails closed on anything unparseable', () => {
    expect(isAllowedAppUrl('')).toBe(false);
    expect(isAllowedAppUrl('/hub')).toBe(false);
    expect(isAllowedAppUrl('not a url')).toBe(false);
  });

  it('contains no pattern entry — anyone can deploy to *.vercel.app', () => {
    for (const origin of ALLOWED_APP_ORIGINS) {
      expect(origin.includes('*')).toBe(false);
      expect(origin.startsWith('https://')).toBe(true);
    }
  });

  it('is the same list SSO uses — two lists were never allowed to disagree', () => {
    const route = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'src/app/api/auth/sso/route.ts'), 'utf8');
    expect(route).toContain("from '@/domains/allowed-origins'");
    // No second copy: a literal array of origins in the route is a re-fork.
    expect(/const ALLOWED_TARGETS = \[/.test(route)).toBe(false);
  });
});
