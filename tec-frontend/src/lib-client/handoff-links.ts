'use client';

// One-time sign-in links for apps opened from a Hub page (C-123 §12).
//
// The Quest and the campaign open an app standalone so Pi counts the visit as
// the app's (§9). This asks the Hub — while the visitor is still here, where
// their session is — for a link straight to each app's own sso-callback, so the
// app arrives signed in without ever sending the visitor back to the Hub.
//
// Every failure falls back to the plain app link: a link that is not ready, a
// Hub that could not sign one, a token past its 5 minutes. The worst case is
// exactly the behaviour before this file existed.

import { useCallback, useEffect, useRef, useState } from 'react';

const REFRESH_MS = 4 * 60 * 1000; // tokens live 5 minutes (api/auth/sso)

const csrf = (): string => {
  if (typeof document === 'undefined') return '';
  return decodeURIComponent(document.cookie.match(/(?:^|;\s*)tec_csrf=([^;]*)/)?.[1] ?? '');
};

export interface HandoffLinks {
  /** The signed link for `href`, or `href` itself when there is none. */
  (href: string): string;
  /** A link was tapped: its token is spent — fetch a fresh set, AFTER the tap. */
  spent: (href: string) => void;
}

export function useHandoffLinks(hrefs: readonly string[], enabled: boolean): HandoffLinks {
  const [links, setLinks] = useState<Record<string, string>>({});
  const key = hrefs.join('\n');
  const inFlight = useRef(false);
  // Links whose token a tap has used. Kept OUT of state on purpose (see spent)
  // and dropped the moment the visitor is back on this page.
  const spentRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!enabled || !key || inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch('/api/auth/sso-links', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() },
        body: JSON.stringify({ targets: key.split('\n') }),
      });
      const data = res.ok ? await res.json().catch(() => null) as { links?: unknown } | null : null;
      const next = data?.links && typeof data.links === 'object' ? data.links as Record<string, unknown> : {};
      spentRef.current.clear();
      setLinks(Object.fromEntries(
        Object.entries(next).filter((e): e is [string, string] => typeof e[1] === 'string'),
      ));
    } catch {
      setLinks({}); // plain links — today's behaviour
    } finally {
      inFlight.current = false;
    }
  }, [enabled, key]);

  useEffect(() => {
    if (!enabled) { setLinks({}); return; }
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    // Back from an app (Pi Browser has one history stack): the token that was
    // tapped is spent, and the others may be near the end of their 5 minutes.
    // On the way back the page can be restored as it was — spent tokens still in
    // the hrefs — and a quick tap reused one: `replay_detected` on Commerce,
    // Assets and Ecommerce (phone, 2026-09-26). Drop them FIRST, so a tap before
    // the fresh set arrives takes the plain link, never a used token.
    const again = () => {
      if (document.visibilityState !== 'visible') return;
      if (spentRef.current.size) {
        const used = new Set(spentRef.current);
        spentRef.current.clear();
        setLinks((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !used.has(k))));
      }
      void load();
    };
    document.addEventListener('visibilitychange', again);
    window.addEventListener('pageshow', again);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', again);
      window.removeEventListener('pageshow', again);
    };
  }, [enabled, load]);

  const resolve = useCallback((href: string) => links[href] ?? href, [links]) as HandoffLinks;
  // NOT a state change inside the tap. The browser reads the link's href AFTER
  // the click handlers have run — and React applies a state update from a
  // click before that. Dropping the spent link here swapped the href back to
  // the plain app link in the very tap that was meant to use it: on a phone
  // (2026-09-26) sso-links answered 200 every time and not one app received
  // an sso-callback. The fresh set simply replaces it a moment later; until
  // then a second tap reuses the spent token, which the app now treats as a
  // visit without one (sso-callback carries on, C-123 §12).
  resolve.spent = (href: string) => {
    spentRef.current.add(href);
    setTimeout(() => void load(), 1_000);
  };
  return resolve;
}
