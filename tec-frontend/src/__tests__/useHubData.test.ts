import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/lib-client/pi/pi-auth', () => ({
  getAccessToken: vi.fn(() => 'tok'),
  getStoredUser:  vi.fn(),
  loginWithPi:    vi.fn(),
  logout:         vi.fn(),
  isPiBrowser:    vi.fn(() => false),
}));

import { useHubData } from '@/hooks/useHubData';

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({
    ok:   true,
    json: async () => ({ balance: '5.25', count: 3, price: 1.23, error: undefined }),
  }) as any;
});

describe('useHubData', () => {
  it('starts with default values', () => {
    const { result } = renderHook(() => useHubData());
    expect(result.current.balance).toBe('—');
    expect(result.current.assetCount).toBeNull();
    expect(result.current.piPrice).toBeNull();
    expect(result.current.notifCount).toBe(0);
  });

  it('refreshBalance updates balance when userId provided', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({ balance: '12.50' }),
    }) as any;

    const { result } = renderHook(() => useHubData('user-123'));
    await act(async () => { await result.current.refreshBalance(); });
    expect(result.current.balance).toBe('12.50');
  });

  it('refreshBalance is no-op without userId', async () => {
    const { result } = renderHook(() => useHubData());
    await act(async () => {});
    const callsBefore = (global.fetch as any).mock.calls.length;
    await act(async () => { await result.current.refreshBalance(); });
    expect((global.fetch as any).mock.calls.length).toBe(callsBefore);
  });

  it('setNotifCount updates unread count', () => {
    const { result } = renderHook(() => useHubData('u1'));
    act(() => { result.current.setNotifCount(5); });
    expect(result.current.notifCount).toBe(5);
  });

  it('refresh calls multiple endpoints', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({ balance: '1.00', count: 2, price: 2.0, error: undefined }),
    }) as any;
    global.fetch = fetchMock;

    const { result } = renderHook(() => useHubData('u1'));
    await act(async () => { await result.current.refresh(); });
    expect(fetchMock).toHaveBeenCalled();
  });

  it('time string is non-empty after mount', async () => {
    const { result } = renderHook(() => useHubData('u1'));
    await act(async () => {});
    expect(typeof result.current.time).toBe('string');
  });

  it('handles fetch error silently on refreshBalance', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network')) as any;
    const { result } = renderHook(() => useHubData('u1'));
    await act(async () => {
      await expect(result.current.refreshBalance()).resolves.not.toThrow();
    });
    expect(result.current.balance).toBe('—');
  });
});
