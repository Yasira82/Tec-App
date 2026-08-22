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

import { useOrders }        from '@/lib-client/hooks/useOrders';
import { getAccessToken, getStoredUser } from '@/lib-client/pi/pi-auth';

const mockGetAccessToken = vi.mocked(getAccessToken);
const mockGetStoredUser  = vi.mocked(getStoredUser);

const makeOrder = (id: string, status = 'PAID' as const) => ({
  id,
  buyer_id:      'u1',
  status,
  total:         10,
  currency:      'Pi',
  payment_id:    'pay-1',
  notes:         null,
  created_at:    new Date().toISOString(),
  updated_at:    new Date().toISOString(),
  paid_at:       new Date().toISOString(),
  cancelled_at:  null,
  cancel_reason: null,
  items:         [],
});

const mockUser = { id: 'u1', piId: 'pi1', piUsername: 'alice', role: 'user', subscriptionPlan: null, createdAt: '' };

beforeEach(() => {
  vi.clearAllMocks();
  // These hooks gate on IDENTITY, not on a readable token — a Pi Browser context
  // can hide the cookie from JS while the session is live. Signing in for the
  // test means putting a user in the session, which is what the app does.
  tecSession.clear();
  tecSession.set('tok', { id: 'u-1' } as never);
  mockGetAccessToken.mockReturnValue('tok');
  mockGetStoredUser.mockReturnValue(mockUser as any);
  global.fetch = vi.fn().mockResolvedValue({
    ok:   true,
    json: async () => ({ success: true, data: { orders: [makeOrder('o1'), makeOrder('o2')], total: 2 } }),
  }) as any;
});

describe('useOrders — signed out', () => {
  it('reports the auth failure when nobody is signed in', async () => {
    // "Signed out" is the absence of an IDENTITY, not of a readable token: the
    // browser can withhold the token from JS on a perfectly live session.
    tecSession.clear();
    mockGetAccessToken.mockReturnValue(null);
    mockGetStoredUser.mockReturnValue(null);
    const { result } = renderHook(() => useOrders());
    await act(async () => {});
    expect(result.current.error).toBeTruthy();
    expect(result.current.isLoading).toBe(false);
  });

  it('still loads when the token is unreadable but the identity is known', async () => {
    // The case the wallet page failed on: no cookie the client can see, no token
    // in hand, and a session that is nonetheless entirely real.
    tecSession.clear();
    tecSession.setUser({ id: 'u-1' } as never);
    mockGetAccessToken.mockReturnValue(null);
    mockGetStoredUser.mockReturnValue(null);
    const { result } = renderHook(() => useOrders());
    await act(async () => {});
    expect(result.current.error).toBeNull();
  });
});

describe('useOrders — success', () => {
  it('loads orders on mount', async () => {
    const { result } = renderHook(() => useOrders());
    await act(async () => {});
    expect(result.current.isLoading).toBe(false);
    expect(result.current.orders).toHaveLength(2);
    expect(result.current.total).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it('calls commerce orders endpoint', async () => {
    renderHook(() => useOrders());
    await act(async () => {});
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/commerce/orders'),
      expect.anything(),
    );
  });
});

describe('useOrders — fetch error', () => {
  it('sets error on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }) as any;
    const { result } = renderHook(() => useOrders());
    await act(async () => {});
    expect(result.current.error).toBeTruthy();
    expect(result.current.orders).toHaveLength(0);
  });

  it('sets error on network throw', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network')) as any;
    const { result } = renderHook(() => useOrders());
    await act(async () => {});
    expect(result.current.error).toBeTruthy();
  });
});

describe('useOrders — filtering', () => {
  it('setFilterStatus updates filter', async () => {
    const { result } = renderHook(() => useOrders());
    await act(async () => {});
    expect(result.current.filterStatus).toBe('all');
    act(() => { result.current.setFilterStatus('PAID'); });
    expect(result.current.filterStatus).toBe('PAID');
  });

  it('includes status filter in request when not all', async () => {
    const { result } = renderHook(() => useOrders());
    await act(async () => {});
    act(() => { result.current.setFilterStatus('PENDING'); });
    await act(async () => {});
    const lastCall = (global.fetch as any).mock.calls.at(-1)?.[0] as string;
    expect(lastCall).toContain('status=PENDING');
  });
});

describe('useOrders — pagination', () => {
  it('totalPages is computed correctly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({ success: true, data: { orders: [], total: 25 } }),
    }) as any;
    const { result } = renderHook(() => useOrders());
    await act(async () => {});
    expect(result.current.totalPages).toBe(3); // ceil(25/10)
  });

  it('setPage triggers refetch', async () => {
    const { result } = renderHook(() => useOrders());
    await act(async () => {});
    const callCount = (global.fetch as any).mock.calls.length;
    act(() => { result.current.setPage(2); });
    await act(async () => {});
    expect((global.fetch as any).mock.calls.length).toBeGreaterThan(callCount);
  });
});

describe('useOrders — refetch', () => {
  it('refetch re-triggers fetch', async () => {
    const { result } = renderHook(() => useOrders());
    await act(async () => {});
    const callCount = (global.fetch as any).mock.calls.length;
    act(() => { result.current.refetch(); });
    await act(async () => {});
    expect((global.fetch as any).mock.calls.length).toBeGreaterThan(callCount);
  });
});
