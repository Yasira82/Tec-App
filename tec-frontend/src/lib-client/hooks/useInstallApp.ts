'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Shared "Add TEC to your home screen" logic.
 *
 * Extracted so the landing banner and the Dashboard menu drive the SAME behaviour
 * from one place (P2 — no duplicated rule). Two paths:
 *  - Chromium/Android fires `beforeinstallprompt` → use the native install dialog.
 *  - Pi Browser / iOS never fire it (Pi Browser is an in-app webview with no
 *    "Add to Home screen" at all), so the only route is to reopen the page in the
 *    phone's real browser and add it from there.
 */
type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export interface InstallApp {
  /** Already running from the home screen — nothing to install. */
  isStandalone: boolean;
  /** A native install dialog is available (otherwise we fall back to the steps). */
  hasNativePrompt: boolean;
  /** The URL to add to the home screen — the app ROOT, not the current page.
   *  A deep link like /dashboard needs a session the fresh browser won't have. */
  installUrl: string;
  /** Runs the native prompt if one exists.
   *  Resolves true when the manual steps must be shown instead. */
  install: () => Promise<boolean>;
  /** Copies `installUrl` so the user can paste it into their real browser. */
  copyLink: () => Promise<boolean>;
}

export function useInstallApp(): InstallApp {
  const [deferred,   setDeferred]   = useState<BIPEvent | null>(null);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) { setStandalone(true); return; }

    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); };
    const onInstalled = () => setStandalone(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (deferred) {
      try {
        await deferred.prompt();
        await deferred.userChoice;
      } catch { /* user closed the native prompt */ }
      setDeferred(null);
      return false;
    }
    // NO window.open here. Pi Browser is an in-app webview and there is no web API
    // to launch the phone's real browser from it — window.open just opened ANOTHER
    // Pi Browser tab on the same page, which looked like the button did nothing.
    // The only route that actually works is: copy the link, paste it in Chrome.
    return true;
  }, [deferred]);

  const copyLink = useCallback(async () => {
    const url = typeof window !== 'undefined' ? window.location.origin : '';
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;   // caller shows the URL as selectable text instead
    }
  }, []);

  const installUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return { isStandalone: standalone, hasNativePrompt: !!deferred, installUrl, install, copyLink };
}
