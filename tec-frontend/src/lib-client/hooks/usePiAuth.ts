'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { loginWithPi, getStoredUser, isPiBrowser, logout as piLogout } from '@/lib-client/pi/pi-auth';
import { ensureCanonicalAccount } from '@/lib-client/pi/account-check';
import { tecSession } from '@/lib-client/pi/tec-session';
import { silentReauth } from '@/lib-client/pi/bff-client';
import { TecUser } from '@/types/pi.types';

// Both bounds exist for the same screen: the Hub shows a skeleton until this hook
// settles, and nothing else on it moves. Back from an app in Pi Browser, the Hub
// can open in a context that has none of its cookies (C-123 §7) — /api/auth/me is
// a 401 and the only way in is a silent Pi sign-in, which could wait 15 s for the
// SDK plus 45 s for Pi. A minute of grey cards read as a black screen, and the next
// back left the app (owner, phone, 2026-09-29). Bounded, the worst case is the
// sign-in page, with the Hub remembered as where to return.
export const ME_TIMEOUT_MS         = 8_000;
export const LOAD_REAUTH_BUDGET_MS = 20_000;

const within = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p,
    new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), ms); }),
  ]).finally(() => clearTimeout(timer));
};

interface AuthState {
  user:            TecUser | null;
  isLoading:       boolean;
  isAuthenticated: boolean;
  isNewUser:       boolean;
  /** No session was found, and a silent Pi sign-in is running — say so on screen. */
  signingIn:       boolean;
  error:           string | null;
  errorType:       'not_pi_browser' | 'auth_failed' | 'timeout' | 'storage' | null;
}

export interface UsePiAuthOptions {
  /**
   * Try a silent Pi sign-in on load when no session is found (C-123 §7 step 4).
   * Default true. The Hub turns it off when the page was reached with Back:
   * Pi does not answer an authenticate nobody tapped for there, so the attempt
   * only spent its whole budget before the sign-in screen (owner, 2026-10-02 —
   * the same Pi answered at once when the button was tapped).
   */
  silentOnLoad?: boolean;
}

export const usePiAuth = ({ silentOnLoad = true }: UsePiAuthOptions = {}) => {
  const [state, setState] = useState<AuthState>({
    user:            null,
    isLoading:       true,
    isAuthenticated: false,
    isNewUser:       false,
    signingIn:       false,
    error:           null,
    errorType:       null,
  });

  // Once login() (or a client-cookie read) establishes auth, a late
  // /api/auth/me response must NOT clobber it back to unauthenticated.
  const authSettledRef = useRef(false);
  // Read once, at mount — the load path runs once per page load.
  const silentOnLoadRef = useRef(silentOnLoad);

  useEffect(() => {
    let cancelled = false;

    const settle = (user: TecUser | null) => {
      if (cancelled || authSettledRef.current) return;
      if (user) authSettledRef.current = true;
      setState(prev => ({ ...prev, user, isAuthenticated: !!user, isLoading: false, signingIn: false }));
      // A session opened on a duplicate account moves to the Pioneer's oldest — once per tab.
      if (user) void ensureCanonicalAccount(user.id);
    };

    // 0) In-memory session survives client-side navigation regardless of cookies.
    if (tecSession.user) { settle(tecSession.user); return; }

    // 1) Fast path: read the tec_user cookie from the client.
    const stored = getStoredUser();
    if (stored) { settle(stored); return; }

    // 2) Server resolver: Pi Browser may hide the cookie from JS while still
    // sending it — the server can always read the request cookie.
    // 3) LAST RESORT — the cookie-independent path (C-123 §7): in Pi Browser,
    // silently re-authenticate ONCE per page load. The session then lives in
    // memory and BFF calls carry it as an Authorization header, so the app
    // works even when the browser context refuses cookies entirely.
    (async () => {
      try {
        // Bounded: a request that never answers must not hold the page. An abort
        // lands in the catch below → unauthenticated, the same as a 401.
        const ctrl  = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), ME_TIMEOUT_MS);
        let res: Response;
        try {
          res = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store', signal: ctrl.signal });
        } finally {
          clearTimeout(timer);
        }
        const data = res.ok ? await res.json() : null;
        const user = (data?.user ?? null) as TecUser | null;
        // Share it. This hook is the only place that knows how to resolve an
        // identity through all four paths; anything else that asks has to be able
        // to get the same answer.
        if (user) tecSession.setUser(user);
        if (user || cancelled || authSettledRef.current) { settle(user); return; }

        if (silentOnLoadRef.current && isPiBrowser()) {
          // Shared single-flight + cooldown lives in bff-client — parallel hook
          // instances and 401-healing BFF calls all reuse one attempt.
          if (!cancelled) setState(prev => ({ ...prev, signingIn: true }));
          const autoUser = await within(silentReauth(), LOAD_REAUTH_BUDGET_MS, null);
          settle(autoUser);
          return;
        }
        settle(null);
      } catch {
        settle(null);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null, errorType: null }));
    try {
      const result = await loginWithPi();

      // ✅ بعد الـ cookie migration — الـ user بييجي من response مش من cookie
      const user = result.user ?? getStoredUser();

      if (user) authSettledRef.current = true;
      setState(prev => ({
        ...prev,
        user,
        isAuthenticated: !!user,
        isNewUser:       result.isNewUser,
        isLoading:       false,
        signingIn:       false,
        error:           null,
        errorType:       null,
      }));
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'فشل تسجيل الدخول';
      let errorType: AuthState['errorType'] = 'auth_failed';
      if (message.includes('Pi Browser') || message.includes('متصفح Pi')) {
        errorType = 'not_pi_browser';
      } else if (message.includes('timed out') || message.includes('انتهت مهلة')) {
        errorType = 'timeout';
      } else if (message.includes('localStorage') || message.includes('بيانات المصادقة')) {
        errorType = 'storage';
      }
      setState(prev => ({
        ...prev,
        isLoading: false,
        signingIn: false,
        error:     message,
        errorType,
      }));
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await piLogout();
    authSettledRef.current = false;
    setState(prev => ({
      ...prev,
      user:            null,
      isAuthenticated: false,
      isNewUser:       false,
      error:           null,
      errorType:       null,
    }));
  }, []);

  return { ...state, login, logout };
};
