/**
 * Smoke tests for usePiAuth hook with mocked Pi SDK.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ---- mock next/navigation ----
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// ---- mock Pi SDK modules ----
vi.mock('@/lib-client/pi/pi-auth', () => ({
  loginWithPi:   vi.fn(),
  getStoredUser: vi.fn(),
  logout:        vi.fn(),
  isPiBrowser:   vi.fn(() => false),
}));

import { usePiAuth }  from '@/lib-client/hooks/usePiAuth';
import * as piAuth    from '@/lib-client/pi/pi-auth';

describe('usePiAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // When the client can't read the cookie, usePiAuth asks the server
    // (GET /api/auth/me). Default it to "no session" for these tests.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   false,
      status: 401,
      json: async () => ({ authenticated: false, user: null }),
    }));
  });

  it('ends unauthenticated when neither cookie nor server has a session', async () => {
    vi.mocked(piAuth.getStoredUser).mockReturnValue(null);

    const { result } = renderHook(() => usePiAuth());

    // It starts loading (it's now checking the server), then settles unauthenticated.
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('falls back to the server (/api/auth/me) when the client cookie is unreadable', async () => {
    // Pi Browser hides the cookie from JS → getStoredUser returns null, but the
    // server can read it and returns the user. The hook must trust the server.
    vi.mocked(piAuth.getStoredUser).mockReturnValue(null);
    const serverUser = {
      id: '9', piId: 'uid-9', piUsername: 'pi_user',
      role: 'user', subscriptionPlan: null, createdAt: new Date().toISOString(),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ authenticated: true, user: serverUser }),
    }));

    const { result } = renderHook(() => usePiAuth());

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user).toEqual(serverUser);
    expect(result.current.isLoading).toBe(false);
  });

  it('restores stored user on mount', async () => {
    const mockUser = {
      id:               '1',
      piId:             'uid-123',
      piUsername:       'testuser',
      role:             'user',
      subscriptionPlan: null,
      createdAt:        new Date().toISOString(),
    };
    vi.mocked(piAuth.getStoredUser).mockReturnValue(mockUser);

    const { result } = renderHook(() => usePiAuth());
    await act(async () => {});

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
  });

  it('handles login success', async () => {
    vi.mocked(piAuth.getStoredUser).mockReturnValue(null);

    const mockUser = {
      id:               '1',
      piId:             'uid-123',
      piUsername:       'testuser',
      role:             'user',
      subscriptionPlan: null,
      createdAt:        new Date().toISOString(),
    };

    vi.mocked(piAuth.loginWithPi).mockResolvedValue({
      success:   true,
      isNewUser: false,
      user:      mockUser,
      tokens:    { accessToken: 'token', refreshToken: 'refresh' },
    });

    const { result } = renderHook(() => usePiAuth());

    await act(async () => {
      await result.current.login();
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.error).toBeNull();
  });

  it('handles login failure with not_pi_browser error type', async () => {
    vi.mocked(piAuth.getStoredUser).mockReturnValue(null);
    vi.mocked(piAuth.loginWithPi).mockRejectedValue(
      new Error('Please open the app inside Pi Browser to authenticate.')
    );

    const { result } = renderHook(() => usePiAuth());

    await act(async () => {
      try {
        await result.current.login();
      } catch {
        // expected
      }
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.errorType).toBe('not_pi_browser');
  });

  it('calls logout and clears state', async () => {
    const mockUser = {
      id:               '1',
      piId:             'uid-123',
      piUsername:       'testuser',
      role:             'user',
      subscriptionPlan: null,
      createdAt:        new Date().toISOString(),
    };
    vi.mocked(piAuth.getStoredUser).mockReturnValue(mockUser);
    // ✅ logout الآن async
    vi.mocked(piAuth.logout).mockResolvedValue(undefined as any);

    const { result } = renderHook(() => usePiAuth());
    await act(async () => {});

    // ✅ await لأن logout أصبح async
    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(piAuth.logout).toHaveBeenCalledOnce();
  });
});
