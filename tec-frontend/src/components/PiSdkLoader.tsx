'use client';
import { resolvePiAppId } from '@/lib-client/pi/pi-app-id';
import { isTestnetHost as isTestnetHostname } from '@/lib/pi-network';

import { useEffect, useCallback } from 'react';

interface Props { sandbox: boolean; timeout: number; onReady?: () => void; }

/**
 * SANDBOX IS NOT THE TESTNET. Three separate axes, and conflating them cost
 * this platform days:
 *
 *   the HOST     picks which Pi APP the browser is talking to
 *   that app's   API KEY picks which NETWORK Pi settles on
 *   `sandbox`    points the SDK at Pi's SANDBOX environment entirely
 *
 * The Hub's paired Testnet app is a normal app on its own host, NOT the
 * sandbox. Initialising with sandbox:true there left the Pi bridge silent
 * ("Messaging promise with id 1 timed out after 120000ms") — measured on the
 * fleet, not theorised.
 *
 * `?pi_sandbox=1` is the way into the real sandbox, honoured ONLY on the
 * Testnet host, so no query param can put a Mainnet payment into sandbox mode.
 *
 * The Mainnet arm returns the configured value untouched — but note the caller
 * that produces it: the Hub read `NEXT_PUBLIC_PI_SANDBOX !== 'false'`, i.e. it
 * defaulted to **true** where every other app in the fleet reads `=== 'true'`.
 * Unset or misspelled, the Hub came up in sandbox. That polarity is corrected
 * in layout.tsx; this function is where the host has the final word.
 */
// Imported, not re-written. This WAS a second copy of the same regex, and the
// `-test` pairing is exactly the kind of change that lands in one copy and not
// the other — on this path that means the Hub passes its Mainnet appId on a
// Testnet host, and authenticate then never answers.
const isTestnetHost = (): boolean =>
  typeof window !== 'undefined' && isTestnetHostname(window.location.hostname);

/**
 * The Pi app id to initialise with — or NOTHING, on the paired Testnet host.
 *
 * `NEXT_PUBLIC_PI_APP_ID` is one Vercel variable holding the **Mainnet** Hub's
 * app id, and it is inlined at build time. On `tec-app-frontend.vercel.app` the
 * browser is inside the Hub's **Testnet** Pi app, so passing that id tells the
 * SDK a different app than the one the host actually is. `Pi.authenticate()`
 * then never answers: the modal sits on "Authenticating…" until it times out,
 * with nothing logged anywhere, because nothing failed.
 *
 * Omitting it is not a workaround — it is what **every other app in the fleet
 * already does**. A grep of all 26 repos found `appId` passed in exactly one
 * place: here. The SDK resolves the app from the HOST, which is the only thing
 * that differs between a Mainnet app and its paired Testnet twin, and that is
 * precisely why one build can serve both.
 *
 * The Mainnet host is untouched: it keeps passing the configured id, which is
 * correct there and has always worked.
 *
 * Fifth instance of one bug: `APP_URL` · `sandbox` · `HUB_URL` · now `appId` —
 * a build-time constant answering a question only the request can answer.
 */
const resolveAppId = (): string | undefined =>
  resolvePiAppId();

const resolveSandbox = (configured: boolean): boolean => {
  if (typeof window === 'undefined') return configured;
  if (!isTestnetHost()) return configured;
  try {
    return new URLSearchParams(window.location.search).get('pi_sandbox') === '1';
  } catch {
    return false;
  }
};

export default function PiSdkLoader({ sandbox: configured, timeout, onReady }: Props) {
  const stableOnReady = useCallback(() => onReady?.(), [onReady]);

  useEffect(() => {
    const appId   = resolveAppId();
    const sandbox = resolveSandbox(configured);

    const callInit = (): boolean => {
      if (typeof window.Pi === 'undefined') return false;
      try {
        window.Pi.init({ version: '2.0', sandbox, ...(appId ? { appId } : {}) });
      } catch (e) {
        const msg = e instanceof Error ? e.message.toLowerCase() : '';
        if (!msg.includes('already')) return false;
      }
      // ✅ mark ready synchronously — no setTimeout hack
      window.__TEC_PI_READY = true;
      window.dispatchEvent(new Event('tec-pi-ready'));
      stableOnReady();
      return true;
    };

    // ✅ re-init on bfcache restore (Pi Browser drops bridge on background)
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        window.__TEC_PI_READY = false;
        callInit();
      }
    };
    window.addEventListener('pageshow', onPageShow);

    if (callInit()) return () => window.removeEventListener('pageshow', onPageShow);

    const startTime = Date.now();
    const poll = setInterval(() => {
      if (callInit()) { clearInterval(poll); return; }
      if (Date.now() - startTime >= timeout) {
        clearInterval(poll);
        window.__TEC_PI_ERROR = true;
        window.dispatchEvent(new CustomEvent('tec-pi-error', {
          detail: { message: 'SDK load timeout' },
        }));
      }
    }, 100);

    return () => {
      clearInterval(poll);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [configured, timeout, stableOnReady]);

  return null;
}
