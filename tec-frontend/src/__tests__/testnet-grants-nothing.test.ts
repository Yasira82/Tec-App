// @vitest-environment node
//
// A Testnet host activates NOTHING, so it must show nothing either.
//
// commerce already refuses to grant PRO from a payment marked `testnet` —
// Test-Pi never buys anything real. But the READ side had no such rule, so the
// owner's genuine Mainnet subscription showed through on the test network:
// "★ You're on Pro" on a host where nothing can grant, renew or expire that
// plan. Confusing at best, and it made a Test-Pi payment look like it had
// worked when the backend had correctly declined it.
//
// The two halves now agree: the test network neither grants nor displays.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GET } from '@/app/api/subscriptions/route';
import { NextRequest } from 'next/server';

const call = (host: string) =>
  GET(new NextRequest('https://x/api/subscriptions?endpoint=status', {
    headers: { host, authorization: 'Bearer t' },
  }));

describe('the Testnet host reports FREE', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('must not ask commerce'); }));
    // PIN THE ENVIRONMENT THIS TEST RUNS IN.
    //
    // `isE2eMode()` is true whenever `CI === 'true'` — which GitHub Actions
    // always sets — and in that mode the route answers a deterministic stub for
    // EVERY host. So this suite passed locally and failed in CI, for a reason
    // that had nothing to do with the rule under test.
    //
    // A test that inherits an ambient env var is not testing the branch it
    // claims to. Pin it, and cover the E2E branch explicitly below.
    vi.stubEnv('CI', 'false');
    vi.stubEnv('E2E_MODE', '');
    vi.stubEnv('NEXT_PUBLIC_E2E_MODE', '');
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('answers FREE without asking commerce at all', async () => {
    // The fetch stub throws: reaching the gateway from a Testnet host fails
    // this test loudly rather than quietly returning the Mainnet plan.
    const res  = await call('tec-app-frontend.vercel.app');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.plan).toBe('FREE');
    expect(body.data.testnet).toBe(true);
  });

  it('says so on the paired `-test` host too', async () => {
    const body = await (await call('hub-test.tecosystem.app')).json();
    expect(body.data.plan).toBe('FREE');
  });

  // The two below assert the route TRIED to reach commerce. The stub throws and
  // the route turns that into a 503, so "not the FREE envelope" is the signal
  // that the Testnet short-circuit did not fire.
  const reachedCommerce = async (host: string) => {
    const res  = await call(host);
    const body = await res.json().catch(() => ({}));
    expect(body?.data?.testnet).toBeUndefined();
    expect(res.status).not.toBe(200);
  };

  it('is NOT fooled by a look-alike host', async () => {
    // These must read as MAINNET. Matching them would let any host anyone can
    // register turn a paid plan into FREE.
    await reachedCommerce('vercel.app.attacker.com');
    await reachedCommerce('hub.tecosystem.app.evil.example');
  });

  it('leaves the Mainnet host alone — it still asks commerce', async () => {
    await reachedCommerce('hub.tecosystem.app');
  });
});

describe('E2E mode', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('must not ask commerce'); }));
    vi.stubEnv('CI', 'true');
    vi.stubEnv('E2E_ALLOW_NETWORK', '');
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('still never reaches the network, on either network', async () => {
    // E2E mode exists so no route makes an external call. The Testnet gate does
    // not either, so the two cannot conflict — and neither may answer by
    // calling commerce. Pinned rather than assumed, because the assumption is
    // exactly what broke CI.
    for (const host of ['hub.tecosystem.app', 'tec-app-frontend.vercel.app']) {
      const res = await call(host);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(String(body.data.plan).toUpperCase()).toBe('FREE');
    }
  });
});

describe('the rule is read from the request, not from the build', () => {
  const route = readFileSync(
    join(process.cwd(), 'src/app/api/subscriptions/route.ts'), 'utf8',
  );

  it('uses this route\'s OWN Host header', () => {
    // One build serves both hosts. A `NEXT_PUBLIC_*` or any build-time constant
    // cannot answer "which network is this request on" — that constant is the
    // shape of every host-vs-network bug in this series.
    expect(route).toContain("isTestnetHost(req.headers.get('host'))");
  });

  it('shares the ONE detector, rather than re-deciding what a Testnet host is', () => {
    expect(route).toContain("from '@/lib/pi-network'");
  });

  it('gates the STATUS read only — it does not touch subscribe or cancel', () => {
    // This is display scope. Refusing the activation is commerce's job and it
    // already does it; blocking the write here too would put the same rule in
    // two layers (P2) and let them drift.
    const gate = route.indexOf("isTestnetHost(req.headers.get('host'))");
    const status = route.indexOf("endpoint === 'status'");
    expect(status).toBeGreaterThan(-1);
    expect(gate).toBeGreaterThan(status);
  });
});
