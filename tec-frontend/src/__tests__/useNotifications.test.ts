import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { tecSession } from '@/lib-client/pi/tec-session';

vi.mock('@/lib-client/pi/pi-auth', () => ({
  getAccessToken: vi.fn(),
  getStoredUser:  vi.fn(),
  loginWithPi:    vi.fn(),
  logout:         vi.fn(),
  isPiBrowser:    vi.fn(() => false),
}));

import { useNotifications } from '@/lib-client/hooks/useNotifications';
import { getAccessToken }   from '@/lib-client/pi/pi-auth';

const mockGetAccessToken = vi.mocked(getAccessToken);

const makeNotif = (id: string, read = false) => ({
  id,
  user_id:    'u1',
  type:       'PAYMENT' as const,
  title:      `Notif ${id}`,
  message:    `Message ${id}`,
  read,
  metadata:   null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

beforeEach(() => {
  vi.clearAllMocks();
  // These hooks gate on IDENTITY, not on a readable token — a Pi Browser context
  // can hide the cookie from JS while the session is live. Signing in for the
  // test means putting a user in the session, which is what the app does.
  tecSession.clear();
  tecSession.set('tok', { id: 'u-1' } as never);
  mockGetAccessToken.mockReturnValue('tok');
  global.fetch = vi.fn().mockResolvedValue({
    ok:   true,
    json: async () => ({
      success: true,
      data:    { notifications: [makeNotif('n1'), makeNotif('n2', true)], unreadCount: 1 },
    }),
  }) as any;
});

describe('useNotifications — signed out', () => {
  it('reports the auth failure when nobody is signed in', async () => {
    // "Signed out" is the absence of an IDENTITY, not of a readable token: the
    // browser can withhold the token from JS on a perfectly live session.
    tecSession.clear();
    mockGetAccessToken.mockReturnValue(null);
    const { result } = renderHook(() => useNotifications());
    await act(async () => {});
    expect(result.current.error).toBeTruthy();
    expect(result.current.isLoading).toBe(false);
  });
});

describe('useNotifications — success', () => {
  it('loads notifications on mount', async () => {
    const { result } = renderHook(() => useNotifications());
    await act(async () => {});
    expect(result.current.isLoading).toBe(false);
    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it('calls correct endpoint', async () => {
    renderHook(() => useNotifications());
    await act(async () => {});
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/bff/notifications/list'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });
});

describe('useNotifications — fetch error', () => {
  it('sets error on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }) as any;
    const { result } = renderHook(() => useNotifications());
    await act(async () => {});
    expect(result.current.error).toBeTruthy();
    expect(result.current.notifications).toHaveLength(0);
  });

  it('sets error on fetch throw', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network')) as any;
    const { result } = renderHook(() => useNotifications());
    await act(async () => {});
    expect(result.current.error).toBeTruthy();
  });
});

describe('useNotifications — markAsRead', () => {
  it('calls PATCH endpoint for single notification', async () => {
    let patchUrl = '';
    let patchBody = '';
    global.fetch = vi.fn(async (url: string, opts?: RequestInit) => {
      if (opts?.method === 'PATCH') { patchUrl = url as string; patchBody = opts?.body as string; return { ok: true, json: async () => ({}) }; }
      return {
        ok:   true,
        json: async () => ({
          success: true,
          data:    { notifications: [makeNotif('n1'), makeNotif('n2', true)], unreadCount: 1 },
        }),
      };
    }) as any;

    const { result } = renderHook(() => useNotifications());
    await act(async () => {});
    await act(async () => { await result.current.markAsRead('n1'); });
    expect(patchUrl).toContain('/api/bff/notifications/list');
    expect(JSON.parse(patchBody)).toEqual({ notificationId: 'n1' });
  });

  it('optimistically decrements the unread count on success', async () => {
    const { result } = renderHook(() => useNotifications());
    await act(async () => {});
    expect(result.current.unreadCount).toBe(1);
    await act(async () => { await result.current.markAsRead('n1'); });
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications.find(n => n.id === 'n1')?.read).toBe(true);
  });

  it('resyncs from the server when the PATCH is rejected (badge never lies)', async () => {
    let getCalls = 0;
    global.fetch = vi.fn(async (_url: string, opts?: RequestInit) => {
      if (opts?.method === 'PATCH') return { ok: false, status: 500, json: async () => ({}) };
      getCalls++;
      return {
        ok:   true,
        json: async () => ({
          success: true,
          data:    { notifications: [makeNotif('n1'), makeNotif('n2', true)], unreadCount: 1 },
        }),
      };
    }) as any;

    const { result } = renderHook(() => useNotifications());
    await act(async () => {});                                   // initial load → 1 GET
    await act(async () => { await result.current.markAsRead('n1'); }); // PATCH fails → resync GET
    expect(getCalls).toBeGreaterThanOrEqual(2);
  });
});

describe('useNotifications — markAllAsRead', () => {
  it('calls PATCH read-all endpoint', async () => {
    let patchCalled = false;
    global.fetch = vi.fn(async (_url: string, opts?: RequestInit) => {
      if (opts?.method === 'PATCH') { patchCalled = true; return { ok: true, json: async () => ({}) }; }
      return {
        ok:   true,
        json: async () => ({
          success: true,
          data:    { notifications: [makeNotif('n1')], unreadCount: 1 },
        }),
      };
    }) as any;

    const { result } = renderHook(() => useNotifications());
    await act(async () => {});
    await act(async () => { await result.current.markAllAsRead(); });
    expect(patchCalled).toBe(true);
  });
});

describe('useNotifications — refetch', () => {
  it('refetch sets isRefreshing then clears it', async () => {
    const { result } = renderHook(() => useNotifications());
    await act(async () => {});
    await act(async () => { result.current.refetch(); });
    expect(result.current.isRefreshing).toBe(false);
  });
});
