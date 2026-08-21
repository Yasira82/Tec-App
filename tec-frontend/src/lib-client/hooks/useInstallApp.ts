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
  /** Runs the native prompt, or opens the page in the system browser.
   *  Resolves true when the manual steps should be shown to the user. */
  install: () => Promise<boolean>;
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
    try { window.open(window.location.href, '_blank', 'noopener,noreferrer'); } catch { /* ignore */ }
    return true;   // caller shows the manual steps
  }, [deferred]);

  return { isStandalone: standalone, hasNativePrompt: !!deferred, install };
}
