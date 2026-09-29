/**
 * usePiAuth must settle in bounded time.
 *
 * Reported from a phone on 2026-09-29: open any app from the Hub, press Back, and
 * the Hub is grey cards on a dark page — "a black screen" — and the next Back
 * leaves Pi Browser's tab. The Hub renders HubSkeleton until this hook settles.
 * Back from an app, Pi Browser can reopen the Hub in a context with none of its
 * cookies (C-123 §7): /api/auth/me is a 401, and the only way in is a silent Pi
 * sign-in that could wait 15 s for the SDK plus 45 s for Pi — with nothing on
 * screen to say anything was happening.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { tecSession } from '@/lib-client/pi/tec-session';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock('@/lib-client/pi/pi-auth', () => ({
  loginWithPi:   vi.fn(),
  getStoredUser: vi.fn(() => null),
  logout:        vi.fn(),
  isPiBrowser:   vi.fn(() => true),
}));

vi.mock('@/lib-client/pi/bff-client', () => ({ silentReauth: vi.fn() }));

import { usePiAuth, ME_TIMEOUT_MS, LOAD_REAUTH_BUDGET_MS } from '@/lib-client/hooks/usePiAuth';
import { silentReauth } from '@/lib-client/pi/bff-client';

const USER = {
  id: '7', piId: 'uid-7', piUsername: 'pioneer', role: 'user',
  subscriptionPlan: null, createdAt: new Date().toISOString(),
};
const NO_SESSION = { ok: false, status: 401, json: async () => ({ authenticated: false, user: null }) };

/** Let queued promise callbacks run without advancing the clock. */
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('usePiAuth — bounded resolution', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    tecSession.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(NO_SESSION));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('says it is signing in while the silent Pi sign-in runs, and stops saying so when it lands', async () => {
    let finish!: (u: typeof USER) => void;
    vi.mocked(silentReauth).mockReturnValue(new Promise((r) => { finish = r; }));

    const { result } = renderHook(() => usePiAuth());
    await flush(); await flush();

    expect(result.current.isLoading).toBe(true);
    expect(result.current.signingIn).toBe(true);

    await act(async () => { finish(USER); });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.signingIn).toBe(false);
  });

  it('a silent sign-in that never answers ends in "signed out" after the budget — not a minute of skeleton', async () => {
    vi.mocked(silentReauth).mockReturnValue(new Promise(() => { /* Pi never answers */ }));

    const { result } = renderHook(() => usePiAuth());
    await flush(); await flush();
    expect(result.current.isLoading).toBe(true);

    await act(async () => { vi.advanceTimersByTime(LOAD_REAUTH_BUDGET_MS - 1); });
    expect(result.current.isLoading).toBe(true);

    await act(async () => { vi.advanceTimersByTime(1); });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.signingIn).toBe(false);
  });

  it('a /api/auth/me that never answers is aborted and settles signed out', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise((_res, rej) => {
      init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => usePiAuth());
    await flush();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ cache: 'no-store' }));
    expect(result.current.isLoading).toBe(true);

    await act(async () => { vi.advanceTimersByTime(ME_TIMEOUT_MS); });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(silentReauth).not.toHaveBeenCalled();
  });

  it('a session the server can read never shows the signing-in line', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ authenticated: true, user: USER }),
    }));
    const { result } = renderHook(() => usePiAuth());
    await flush(); await flush();
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.signingIn).toBe(false);
    expect(silentReauth).not.toHaveBeenCalled();
  });
});
