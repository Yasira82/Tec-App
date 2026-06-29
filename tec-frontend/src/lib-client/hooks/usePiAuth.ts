'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { loginWithPi, getStoredUser, logout as piLogout } from '@/lib-client/pi/pi-auth';
import { TecUser } from '@/types/pi.types';

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

    // 1) Fast path: read the tec_user cookie from the client.
    const stored = getStoredUser();
    if (stored) {
      authSettledRef.current = true;
      setState(prev => ({ ...prev, user: stored, isAuthenticated: true, isLoading: false }));
      return;
    }

    // 2) Robust fallback: Pi Browser may hide the cookie from JS even though it
    // sends it to the server. Ask the server who we are — it can always read the
    // request cookie. This is what stops the /hub → / login loop in Pi Browser.
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || authSettledRef.current) return;
        const user = (data?.user ?? null) as TecUser | null;
        if (user) authSettledRef.current = true;
        setState(prev => ({ ...prev, user, isAuthenticated: !!user, isLoading: false }));
      })
      .catch(() => {
        if (cancelled || authSettledRef.current) return;
        setState(prev => ({ ...prev, user: null, isAuthenticated: false, isLoading: false }));
      });

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
