'use client';

/**
 * Back from the Quest (or the campaign) goes to the Hub — never into an app.
 *
 * ── What was happening ─────────────────────────────────────────────────────
 *
 * An app's "Back to the Quest" bar is a forward navigation to
 * `hub.tecosystem.app/pioneers`. It has to be: the app is on another origin and
 * Pi Browser's own back is unreliable across them. But forward means the app is
 * now BEHIND the Quest in history, so Android's back from the Quest returned
 * into the app; its bar pushed the Quest again; and the loop ended, eventually,
 * on the Hub's front page offering "Sign in with Pi" to someone signed in.
 * Seen on a phone, 2026-09-24.
 *
 * ── The rule ───────────────────────────────────────────────────────────────
 *
 * Only when this page was the FIRST page of the document — i.e. it was loaded
 * from outside (an app's bar, a shared link, a fresh Pi Browser context) — is
 * whatever sits behind it foreign. Then one guard entry is pushed, and leaving
 * it with back replaces the page with `/hub`.
 *
 * Reached by navigating inside the Hub, the entry behind is a Hub page, and the
 * browser's own back is already right — including #251's
 * `/ → /hub → push /pioneers`, which puts the Hub directly underneath. Adding a
 * guard there would only cost an extra press.
 */
import { useEffect } from 'react';

const MARK = '__tec_back_to_hub';

/** The document's own first URL — survives client-side navigation. */
const documentEntryPath = (): string | null => {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return nav ? new URL(nav.name).pathname : null;
  } catch { /* ignore */
    return null;
  }
};

const guarded = (state: unknown): boolean =>
  !!state && typeof state === 'object' && (state as Record<string, unknown>)[MARK] === true;

let pushedThisDocument = false;

/**
 * A full replace, not the router: this page has just written its own history
 * entry, and a plain document load is the one thing Pi Browser has never been
 * seen to get wrong.
 */
const goHub = (): void => { window.location.replace('/hub'); };

export function useBackGoesToHub(path: string): void {
  useEffect(() => {
    if (documentEntryPath() !== path) return;

    if (!pushedThisDocument && !guarded(window.history.state)) {
      pushedThisDocument = true;
      const state = { ...(window.history.state ?? {}), [MARK]: true };
      window.history.pushState(state, '');
    }

    const onPop = () => {
      // `history.state` at popstate IS the entry just landed on. Moving forward
      // onto the guard, or leaving for another page: not ours.
      if (guarded(window.history.state) || window.location.pathname !== path) return;
      goHub();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [path]);
}

/** Test seam — the module-level flag lives for one document in the browser. */
export function __resetBackToHubForTests(): void {
  pushedThisDocument = false;
}
