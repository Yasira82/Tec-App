import { describe, it, expect } from 'vitest';
import { buildCsp, enforceNamedConnect } from '@/lib/csp';

/**
 * connect-src — which hosts the page may send data to.
 *
 * 11 Nov 2026 (#324) narrowed it from `'self' https: wss:` to a named list. On 15 Nov the
 * owner could not sign in to the Hub in Pi Browser: `Pi.authenticate` failed in the page and
 * no request reached the server. Rolling Vercel back to the deployment before #324 made
 * sign-in work again — the named list misses a host the Pi SDK reaches, and nobody knows
 * which (the SDK is served by Pi; its hosts cannot be read from here). Every other app kept
 * `https: wss:` and kept working.
 *
 * So the ENFORCED policy is the one proven in production, and the named list runs in the
 * REPORT-ONLY policy beside it: a host the list misses is reported to /api/csp-report and
 * logged, never blocked. When a Pi Browser sign-in and a Mode-2 payment report nothing,
 * CSP_ENFORCE_NAMED_CONNECT=1 enforces the list (and unsetting it is the way back).
 */
const N = 'AAAAAAAAAAAAAAAAAAAAAA==';
const connectSrc = (csp: string): string[] =>
  (csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('connect-src ')) ?? '')
    .split(/\s+/).slice(1);

describe('CSP connect-src — enforced', () => {
  it('is the policy proven in Pi Browser: own origin, any https and wss host', () => {
    expect(connectSrc(buildCsp(N, { allowEval: true }))).toEqual(["'self'", 'https:', 'wss:']);
  });

  it('the switch is off unless set to exactly 1', () => {
    expect(enforceNamedConnect({})).toBe(false);
    expect(enforceNamedConnect({ CSP_ENFORCE_NAMED_CONNECT: 'true' })).toBe(false);
    expect(enforceNamedConnect({ CSP_ENFORCE_NAMED_CONNECT: '1' })).toBe(true);
  });
});

describe('CSP connect-src — the named list (report-only until it is proven)', () => {
  const named = connectSrc(buildCsp(N, { allowEval: false, namedConnect: true }));

  it('names hosts — no bare scheme, no star', () => {
    expect(named.length).toBeGreaterThan(1);
    for (const s of named) expect(['https:', 'wss:', 'http:', 'ws:', '*', 'data:', 'blob:']).not.toContain(s);
  });

  it('still lists everything the browser is known to use', () => {
    for (const needed of [
      "'self'",
      'https://*.minepi.com',          // Pi SDK
      'wss://*.up.railway.app',        // realtime socket (Railway public domain)
      'https://*.up.railway.app',      // socket.io's polling handshake before the upgrade
      'wss://*.tecosystem.app',        // realtime on a custom domain
      'https://*.ingest.sentry.io',    // Sentry
    ]) expect(named).toContain(needed);
  });
});
