// @vitest-environment node
//
// The handoff must not be able to HANG.
//
// `/api/auth/sso` is the only way into every app in the fleet, and it makes an
// outbound call of its own: sso → /api/auth/refresh → gateway → auth-service.
// Not one hop in that chain had a timeout.
//
// An unbounded fetch does not fail, it waits. The invocation waits with it
// until the platform kills it — and a killed function never reaches its catch,
// so the route that was specifically changed to SAY WHY it failed could not
// say anything at all. What reaches the phone is the platform's blank
// "500 Internal Server Error", with no body, no reason, and nothing in any log
// the app controls.
//
// Observed exactly that on `tec-app-frontend.vercel.app/api/auth/sso` while the
// gateway's own logs were showing `socket hang up` / `ECONNRESET` against the
// services it proxies.
//
// Naming the error (the previous fix) is worthless if the handler is the thing
// being killed. The bound has to exist for the message to ever be written.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const sso     = read('src/app/api/auth/sso/route.ts');
const refresh = read('src/app/api/auth/refresh/route.ts');

describe('every outbound hop in the login handoff is bounded', () => {
  it('the SSO route bounds its refresh call', () => {
    expect(sso).toMatch(/signal:\s*AbortSignal\.timeout\(REFRESH_TIMEOUT_MS\)/);
  });

  it('the refresh route bounds its gateway call', () => {
    expect(refresh).toMatch(/signal:\s*AbortSignal\.timeout\(GATEWAY_TIMEOUT_MS\)/);
  });

  it('leaves NO fetch in either route without a signal', () => {
    // The guard that matters. A future hop added without a bound re-opens the
    // exact failure, and it re-opens it silently.
    for (const [name, src] of [['sso', sso], ['refresh', refresh]] as const) {
      const calls = src.split('fetch(').length - 1;
      const bounded = src.split('AbortSignal.timeout(').length - 1;
      expect(`${name}: ${bounded} bounded of ${calls}`).toBe(`${name}: ${calls} bounded of ${calls}`);
    }
  });

  it('the inner budget is SHORTER, so this route decides what the user sees', () => {
    // Whoever gives up first owns the response. The SSO route can still finish
    // the handoff without a refresh; the platform, given the chance, cannot
    // finish anything and answers with a blank page.
    const inner = Number(/REFRESH_TIMEOUT_MS = ([\d_]+)/.exec(sso)?.[1]?.replace(/_/g, ''));
    const outer = Number(/GATEWAY_TIMEOUT_MS = ([\d_]+)/.exec(refresh)?.[1]?.replace(/_/g, ''));
    expect(inner).toBeGreaterThan(0);
    expect(outer).toBeGreaterThan(0);
    expect(inner).toBeLessThan(outer);
  });
});

describe('a failed refresh degrades — it does not abort the handoff', () => {
  it('continues with the existing token rather than throwing', () => {
    // This is what the old code already did when the refresh returned !ok. The
    // timeout must land in the SAME place, not turn a slow hop into a hard
    // failure: a stale token gives the user a login screen they can act on.
    const block = sso.slice(sso.indexOf('const csrfToken'), sso.indexOf('const jti'));
    expect(block).toMatch(/\}\s*catch\s*\(\w+\)\s*\{/);
    expect(block).toContain("console.warn('[sso] refresh failed");
    expect(block).not.toMatch(/throw\b/);
  });

  it('still forwards rotated cookies on the success path', () => {
    // Refresh tokens are single-use. Dropping the rotation kills the session on
    // the NEXT refresh ("Refresh token already used") — a bug this route has
    // had before, and wrapping the call in a try is a chance to lose it again.
    expect(sso).toMatch(/rotatedCookies\s*=\s*refreshRes\.headers\?\.getSetCookie\?\.\(\)/);
    expect(sso).toMatch(/for \(const c of rotatedCookies\) res\.headers\.append\('Set-Cookie', c\)/);
  });
});

describe('the refresh route names the hop that died', () => {
  it('answers 502 with a reason instead of hanging', () => {
    expect(refresh).toContain("error: 'gateway_unreachable'");
    expect(refresh).toMatch(/status:\s*502/);
    expect(refresh).toContain("console.error('[refresh] gateway unreachable'");
  });

  it('bounds the reason so an error cannot become the body', () => {
    expect(refresh).toMatch(/reason\.slice\(0,\s*\d+\)/);
  });
});
