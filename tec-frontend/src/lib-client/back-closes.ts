'use client';

/**
 * Android's back closes the sheet on top — it does not leave the page under it.
 *
 * Seen on a phone, 2026-10-08: TEC AI open over /hub, back pressed, and the browser
 * left /hub for the page before it — the front page, offering "Sign in with Pi" to
 * someone signed in. A sheet is not a page, so it had no history entry, and back
 * did the only thing it could.
 *
 * While the sheet is open it owns one history entry. Back pops that entry and the
 * sheet closes; the page stays. Closed any other way (✕, the backdrop, Escape), the
 * entry is taken back off so the next back press is not spent on nothing.
 * Same mechanism as lib-client/back-to-hub.ts: the existing state is copied into the
 * pushed one, so the router's own fields survive.
 */
import { useEffect, useRef } from 'react';

const MARK = '__tec_sheet';

const ours = (state: unknown): boolean =>
  !!state && typeof state === 'object' && (state as Record<string, unknown>)[MARK] === true;

export function useBackCloses(open: boolean, onClose: () => void): void {
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;
    let popped = false;
    window.history.pushState({ ...(window.history.state ?? {}), [MARK]: true }, '');
    const onPop = () => { popped = true; close.current(); };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (!popped && ours(window.history.state)) window.history.back();
    };
  }, [open]);
}
