import { describe, it, expect } from 'vitest';
const nextConfig = require('../../next.config.js');

/**
 * connect-src names the hosts the page may send data to. It read `'self' https: wss:` —
 * ANY host — under a comment claiming the wildcard was gone ("VM-017 FIXED"). With
 * 'unsafe-inline' in script-src, one injected script could post a session's data
 * anywhere. Engineering review, 2026-11-11.
 *
 * The list is what the browser really reaches: this app's own BFF ('self'), the Pi SDK,
 * the realtime socket (its URL comes from /api/bff/realtime — a Railway public domain or
 * a tecosystem.app host), and Sentry's ingest. Server-side calls (AI providers, prices)
 * are not limited by CSP and do not belong here.
 */
async function connectSrc(): Promise<string[]> {
  const rules: { source: string; headers: { key: string; value: string }[] }[] = await nextConfig.headers();
  const csp = rules.flatMap((r) => r.headers).find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
  const directive = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('connect-src ')) ?? '';
  return directive.split(/\s+/).slice(1);
}

describe('CSP connect-src', () => {
  it('names hosts — no bare scheme, no star', async () => {
    const sources = await connectSrc();
    expect(sources.length).toBeGreaterThan(1);
    for (const s of sources) {
      expect(['https:', 'wss:', 'http:', 'ws:', '*', 'data:', 'blob:']).not.toContain(s);
    }
  });

  it('still allows everything the browser actually uses', async () => {
    const sources = await connectSrc();
    for (const needed of [
      "'self'",
      'https://*.minepi.com',          // Pi SDK
      'wss://*.up.railway.app',        // realtime socket (Railway public domain)
      'https://*.up.railway.app',      // socket.io's polling handshake before the upgrade
      'wss://*.tecosystem.app',        // realtime on a custom domain
      'https://*.ingest.sentry.io',    // Sentry
    ]) expect(sources).toContain(needed);
  });
});
