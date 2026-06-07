import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

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
  mockGetAccessToken.mockReturnValue('tok');
  global.fetch = vi.fn().mockResolvedValue({
    ok:   true,
    json: async () => ({
      success: true,
      data:    { notifications: [makeNotif('n1'), makeNotif('n2', true)], unreadCount: 1 },
    }),
  }) as any;
});

describe('useNotifications — no token', () => {
  it('sets error when no access token', async () => {
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
      expect.stringContaining('/api/notifications'),
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
    global.fetch = vi.fn(async (url: string, opts?: RequestInit) => {
      if (opts?.method === 'PATCH') { patchUrl = url as string; return { ok: true, json: async () => ({}) }; }
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
    expect(patchUrl).toContain('n1');
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
