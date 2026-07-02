'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { loginWithPi, getStoredUser, isPiBrowser, logout as piLogout } from '@/lib-client/pi/pi-auth';
import { tecSession } from '@/lib-client/pi/tec-session';
import { TecUser } from '@/types/pi.types';

// One silent auto-auth attempt per page load (module-level so parallel hook
// instances don't each trigger Pi.authenticate).
let autoAuthAttempted = false;
let autoAuthPromise: Promise<TecUser | null> | null = null;

async function silentPiAuth(): Promise<TecUser | null> {
  if (autoAuthPromise) return autoAuthPromise;
  autoAuthAttempted = true;
  autoAuthPromise = (async () => {
    try {
      const result = await loginWithPi();
      return result?.user ?? null;
    } catch {
      return null;
    }
  })();
  return autoAuthPromise;
}

interface AuthState {
  user:            TecUser | null;
  isLoading:       boolean;
  isAuthenticated: boolean;
  isNewUser:       boolean;
  error:           string | null;
  errorType:       'not_pi_browser' | 'auth_failed' | 'timeout' | 'storage' | null;
}

export const usePiAuth = () => {
  const [state, setState] = useState<AuthState>({
    user:            null,
    isLoading:       true,
    isAuthenticated: false,
    isNewUser:       false,
    error:           null,
    errorType:       null,
  });

  // Once login() (or a client-cookie read) establishes auth, a late
  // /api/auth/me response must NOT clobber it back to unauthenticated.
  const authSettledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const settle = (user: TecUser | null) => {
      if (cancelled || authSettledRef.current) return;
      if (user) authSettledRef.current = true;
      setState(prev => ({ ...prev, user, isAuthenticated: !!user, isLoading: false }));
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
        const res  = await fetch('/api/auth/me', { credentials: 'include' });
        const data = res.ok ? await res.json() : null;
        const user = (data?.user ?? null) as TecUser | null;
        if (user || cancelled || authSettledRef.current) { settle(user); return; }

        if (isPiBrowser() && !autoAuthAttempted) {
          const autoUser = await silentPiAuth();
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
