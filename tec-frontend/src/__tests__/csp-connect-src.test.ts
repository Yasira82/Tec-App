import { describe, it, expect } from 'vitest';
const nextConfig = require('../../next.config.js');

/**
 * connect-src — which hosts the page may send data to.
 *
 * #324 (11 Nov 2026) narrowed it from `'self' https: wss:` to a named list. On 15 Nov the
 * owner could not sign in to the Hub in Pi Browser: `Pi.authenticate` failed in the page and
 * no request reached the server. A Vercel rollback to the deployment before #324 made
 * sign-in work again (TEC-AUDIT-0051): the list misses a host the Pi SDK reaches, and which
 * one cannot be read from here (the SDK is served by Pi). Every other app kept
 * `https: wss:` and kept working.
 *
 * So this is the policy proven in Pi Browser. A narrower list comes back only after it has
 * run in a Report-Only policy and a Pi Browser sign-in and payment reported nothing.
 */
async function connectSrc(): Promise<string[]> {
  const rules: { source: string; headers: { key: string; value: string }[] }[] = await nextConfig.headers();
  const csp = rules.flatMap((r) => r.headers).find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
  const directive = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('connect-src ')) ?? '';
  return directive.split(/\s+/).slice(1);
}

describe('CSP connect-src', () => {
  it("is the policy proven in Pi Browser: 'self' https: wss:", async () => {
    expect(await connectSrc()).toEqual(["'self'", 'https:', 'wss:']);
  });
});
