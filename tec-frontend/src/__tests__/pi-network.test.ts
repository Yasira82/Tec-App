// @vitest-environment node
//
// The Hub was the LAST app in the fleet with no notion of which Pi network a
// payment settles on — `grep -ri testnet src/` returned nothing — and it is the
// Mode-1 payment path for all 24 apps. Two things follow from that.
//
// One: its own paired Testnet host was approving against the MAINNET key, so a
// payment made there was a real payment made from a Testnet host, not a Testnet
// payment.
//
// Two: its metadata schema is `.passthrough()`, which made it the one route in
// the platform where a browser could name the network its own payment settles
// on. `metadata.testnet` is read by payment-service (which key, and therefore
// which network) and by commerce (whether to grant PRO) — so whoever sets it
// decides whether a payment is free.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// The REAL functions the route calls, not a re-implementation. A rule rewritten
// inside a test passes whatever the source does, which is the same as no test.
import { isTestnetHost, networkMetadata } from '@/lib/pi-network';

describe('the network is read from the host', () => {
  it('recognises the paired Testnet host', () => {
    for (const h of ['tec-app-frontend.vercel.app', 'tec-app.vercel.app:443', ' tec-app.vercel.app ']) {
      expect(isTestnetHost(h)).toBe(true);
    }
  });

  it('is not fooled by a host that merely CONTAINS the words', () => {
    for (const h of ['vercel.app.attacker.com', 'notvercel.app.example.com', 'tec-app.vercel.app.evil.com']) {
      expect(isTestnetHost(h)).toBe(false);
    }
  });

  it('fails in the direction that costs nothing', () => {
    // An unknown host means a REAL payment, which at worst fails. The other way
    // round it succeeds with Test-Pi and something real gets granted.
    expect(isTestnetHost(undefined)).toBe(false);
    expect(isTestnetHost(null)).toBe(false);
    expect(isTestnetHost('')).toBe(false);
    expect(isTestnetHost('hub.tecosystem.app')).toBe(false);
  });
});

describe('what travels with the payment', () => {
  it('marks a testnet payment, and marks NOTHING on a real one', () => {
    // Present only when true. A `testnet: false` on every Mainnet payment would
    // put a field about the test network on 100% of real money, and the day it
    // is written backwards is the day it means the opposite of what it says.
    expect(networkMetadata('tec-app-frontend.vercel.app')).toEqual({ testnet: true });
    expect(networkMetadata('hub.tecosystem.app')).toEqual({});
  });
});

describe('the create route owns the claim — no browser does', () => {
  const route = readFileSync(
    join(process.cwd(), 'src/app/api/bff/payment/create/route.ts'), 'utf8',
  );

  it('derives the marker from its OWN Host header', () => {
    expect(route).toContain("networkMetadata(req.headers.get('host'))");
  });

  it('REMOVES a client-sent testnet before the spread', () => {
    // Not merely overwritten by it. On a Mainnet host networkMetadata() returns
    // {}, so the spread overwrites nothing and the caller's claim survives —
    // and this schema is `.passthrough()`, so the caller really can send one.
    // Stripped before the spread so a later reorder cannot hand it back.
    expect(route).toMatch(/const \{ testnet: _clientTestnet, \.\.\.metadata \}/);
  });
});

describe('the Pi app id comes from the host, not from the build', () => {
  const loader = readFileSync(join(process.cwd(), 'src/components/PiSdkLoader.tsx'), 'utf8');

  it('is omitted on the paired Testnet host', () => {
    // `NEXT_PUBLIC_PI_APP_ID` is ONE Vercel variable holding the MAINNET Hub's
    // id, inlined at build time. On the Testnet host the browser is inside the
    // Hub's Testnet Pi app, so that id names a different app than the host is —
    // and Pi.authenticate() then never answers. The modal sat on
    // "Authenticating…" until timeout, with nothing logged, because nothing
    // failed. Measured on tec-app-frontend.vercel.app, not theorised.
    expect(loader).toMatch(/isTestnetHost\(\) \? undefined : process\.env\.NEXT_PUBLIC_PI_APP_ID/);
  });

  it('is read through the resolver, never straight from the env', () => {
    // The raw read must not creep back into the init path — that IS the bug.
    expect(loader).toMatch(/const appId   = resolveAppId\(\);/);
    const initLine = loader.split('\n').find((l) => l.includes('window.Pi.init(')) ?? '';
    expect(initLine).not.toContain('process.env');
  });

  it('matches what every other app in the fleet does', () => {
    // A grep of all 26 repos found `appId` passed to Pi.init in exactly one
    // place: this file. Everywhere else the SDK resolves the app from the HOST
    // — the only thing that differs between a Mainnet app and its Testnet twin,
    // and the reason one build can serve both.
    expect(loader).toContain('appId ? { appId } : {}');
  });
});

describe('sandbox is not the testnet — and the Hub had it inverted', () => {
  const layout = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8');
  const loader = readFileSync(join(process.cwd(), 'src/components/PiSdkLoader.tsx'), 'utf8');

  it('the build flag defaults to FALSE, like every other app in the fleet', () => {
    // It read `!== 'false'`, which defaults to TRUE: unset or misspelled, the
    // Hub came up pointed at Pi's Sandbox — the failure mode as a default
    // rather than as a mistake. Every other app reads `=== 'true'`.
    expect(layout).toContain("process.env.NEXT_PUBLIC_PI_SANDBOX === 'true'");
    expect(layout).not.toContain("NEXT_PUBLIC_PI_SANDBOX !== 'false'");
  });

  it('the host has the final word, and only on the Testnet host', () => {
    // Measured, not assumed: with sandbox:true on `*.vercel.app` the Pi bridge
    // never answered its first message. The Mainnet arm never reads the URL, so
    // no query param can put a Mainnet payment into sandbox mode.
    expect(loader).toMatch(/\.test\(window\.location\.hostname\)/);
    expect(loader).toMatch(/get\('pi_sandbox'\) === '1'/);
    // The host test now lives in `isTestnetHost()` — shared with the app-id
    // resolver, so the two cannot disagree about what a Testnet host is.
    expect(loader).toMatch(/if \(!isTestnetHost\(\)\) return configured;/);
  });
});

describe('an unfinished payment must not poison every payment after it', () => {
  const pay   = readFileSync(join(process.cwd(), 'src/lib-client/pi/pi-payment.ts'), 'utf8');
  const types = readFileSync(join(process.cwd(), 'src/types/pi.types.ts'), 'utf8');

  it('supplies the callback Pi calls instead of opening the wallet', () => {
    // Without it the SDK has nowhere to report a stuck payment, so the flow
    // stops at "Confirm in Pi Wallet…" and waits forever. Nothing errors,
    // nothing logs — the first abandoned payment simply blocks all the rest.
    expect(pay).toMatch(/onIncompletePaymentFound: async \(payment/);
  });

  it('clears the stuck payment through the route that already existed', () => {
    // `/api/payment/resolve-incomplete` was built for exactly this and had
    // never been called from anywhere in the codebase.
    expect(pay).toContain("'/api/payment/resolve-incomplete'");
  });

  it('does not retry from inside its own callback', () => {
    // Re-entering createPayment from within its callback is how a retry loop
    // starts on a money path. The stuck payment is cleared; the user taps once
    // more and the wallet opens.
    const block = pay.slice(pay.indexOf('onIncompletePaymentFound'), pay.indexOf('onCancel:'));
    expect(block).not.toContain('invoke(');
    expect(block).toMatch(/Please tap pay again/);
  });

  it('reports a failure to resolve rather than swallowing it', () => {
    // A silent catch here is the exact shape of the bug being fixed (C-96).
    const block = pay.slice(pay.indexOf('onIncompletePaymentFound'), pay.indexOf('onCancel:'));
    expect(block).toMatch(/onDiagnostic\?\.\('error'/);
  });

  it('the type allows the callback at all — its absence is why nobody added one', () => {
    // TypeScript rejected the property, so adding the handler meant widening
    // the contract first. That is why the gap survived across 26 repos.
    expect(types).toMatch(/onIncompletePaymentFound\?: \(payment/);
  });
});
