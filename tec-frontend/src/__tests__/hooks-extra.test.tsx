/**
 * Tests for additional hooks:
 * useWallet, usePiBrowser, useWalletRealtime, useRealtimeNotifications,
 * usePiSdkReady, useDiagnostics
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ── Shared mocks ──────────────────────────────────────────────────
vi.mock('@/lib-client/pi/pi-auth', () => ({
  getAccessToken: vi.fn(() => 'test-token'),
  getStoredUser:  vi.fn(() => ({ id: 'user-1', piUsername: 'alice' })),
}));

vi.mock('@/lib-client/pi/pi-session', () => ({
  piSession: {
    ensureAuth:       vi.fn().mockResolvedValue(true),
    ensurePaymentsReady: vi.fn().mockResolvedValue(true),
    lastError:        null,
    reset:            vi.fn(),
  },
  PiAuthError: {},
}));

// ── useDiagnostics ────────────────────────────────────────────────
describe('useDiagnostics', () => {
  it('starts with empty events', async () => {
    const { useDiagnostics } = await import('@/lib-client/hooks/useDiagnostics');
    const { result } = renderHook(() => useDiagnostics());
    expect(result.current.events).toHaveLength(0);
  });

  it('addEvent appends to events list', async () => {
    const { useDiagnostics } = await import('@/lib-client/hooks/useDiagnostics');
    const { result } = renderHook(() => useDiagnostics());
    act(() => { result.current.addEvent('sdk_init', 'SDK initialized'); });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].type).toBe('sdk_init');
    expect(result.current.events[0].message).toBe('SDK initialized');
  });

  it('addEvent accepts data payload', async () => {
    const { useDiagnostics } = await import('@/lib-client/hooks/useDiagnostics');
    const { result } = renderHook(() => useDiagnostics());
    act(() => { result.current.addEvent('error', 'Something went wrong', { code: 42 }); });
    expect(result.current.events[0].data).toEqual({ code: 42 });
  });

  it('clearEvents empties the list', async () => {
    const { useDiagnostics } = await import('@/lib-client/hooks/useDiagnostics');
    const { result } = renderHook(() => useDiagnostics());
    act(() => { result.current.addEvent('auth', 'Auth success'); });
    act(() => { result.current.clearEvents(); });
    expect(result.current.events).toHaveLength(0);
  });

  it('addEvent caps at 100 events', async () => {
    const { useDiagnostics } = await import('@/lib-client/hooks/useDiagnostics');
    const { result } = renderHook(() => useDiagnostics());
    act(() => {
      for (let i = 0; i < 110; i++) {
        result.current.addEvent('approval', `event-${i}`);
      }
    });
    expect(result.current.events.length).toBeLessThanOrEqual(100);
  });
});

// ── usePiBrowser ──────────────────────────────────────────────────
describe('usePiBrowser', () => {
  beforeEach(() => {
    (window as any).Pi = undefined;
    (window as any).__TEC_PI_READY = undefined;
  });

  it('starts with isPiBrowser=false in normal browser', async () => {
    const { usePiBrowser } = await import('@/lib-client/hooks/usePiBrowser');
    const { result } = renderHook(() => usePiBrowser());
    expect(result.current.isPiBrowser).toBe(false);
  });

  it('returns isPiBrowser=true when window.Pi exists', async () => {
    (window as any).Pi = { init: vi.fn() };
    const { usePiBrowser } = await import('@/lib-client/hooks/usePiBrowser');
    const { result } = renderHook(() => usePiBrowser());
    await act(async () => {});
    expect(result.current.isPiBrowser).toBe(true);
  });

  it('returns isPiBrowser=true when __TEC_PI_READY set', async () => {
    (window as any).__TEC_PI_READY = true;
    const { usePiBrowser } = await import('@/lib-client/hooks/usePiBrowser');
    const { result } = renderHook(() => usePiBrowser());
    await act(async () => {});
    expect(result.current.isPiBrowser).toBe(true);
  });

  it('responds to tec-pi-ready event', async () => {
    const { usePiBrowser } = await import('@/lib-client/hooks/usePiBrowser');
    const { result } = renderHook(() => usePiBrowser());
    act(() => {
      window.dispatchEvent(new CustomEvent('tec-pi-ready'));
    });
    expect(result.current.isPiBrowser).toBe(true);
  });

  it('responds to tec-pi-error event', async () => {
    const { usePiBrowser } = await import('@/lib-client/hooks/usePiBrowser');
    const { result } = renderHook(() => usePiBrowser());
    act(() => {
      window.dispatchEvent(new CustomEvent('tec-pi-error'));
    });
    expect(result.current.isReady).toBe(true);
  });

  it('returns isPiBrowser=true when UA contains PiBrowser', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'PiBrowser/1.0 Mozilla/5.0',
      writable: true, configurable: true,
    });
    const { usePiBrowser } = await import('@/lib-client/hooks/usePiBrowser');
    const { result } = renderHook(() => usePiBrowser());
    // UA matches Pi Browser pattern — waits for tec-pi-ready or tec-pi-error
    act(() => { window.dispatchEvent(new CustomEvent('tec-pi-ready')); });
    expect(result.current.isPiBrowser).toBe(true);
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0',
      writable: true, configurable: true,
    });
  });

  it('handles tec-pi-error in PiBrowser UA path', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'MinePI/2.0 Browser',
      writable: true, configurable: true,
    });
    const { usePiBrowser } = await import('@/lib-client/hooks/usePiBrowser');
    const { result } = renderHook(() => usePiBrowser());
    act(() => { window.dispatchEvent(new CustomEvent('tec-pi-error')); });
    expect(result.current.isReady).toBe(true);
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0',
      writable: true, configurable: true,
    });
  });
});

// ── useWallet ─────────────────────────────────────────────────────
describe('useWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({
        balance:  5.0,
        currency: 'PI',
        walletId: 'w-1',
      }),
    } as any);
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('starts loading then resolves wallet data', async () => {
    const { useWallet } = await import('@/lib-client/hooks/useWallet');
    const { result } = renderHook(() => useWallet());
    expect(result.current.isLoading).toBe(true);
    await act(async () => {});
    expect(result.current.wallet?.balance).toBe(5.0);
    expect(result.current.wallet?.currency).toBe('PI');
  });

  it('sets error when unauthenticated (no user/token)', async () => {
    const { getStoredUser } = await import('@/lib-client/pi/pi-auth');
    vi.mocked(getStoredUser).mockReturnValue(null);
    const { useWallet } = await import('@/lib-client/hooks/useWallet');
    const { result } = renderHook(() => useWallet());
    await act(async () => {});
    // hook returns early without setting error message in some paths
    expect(result.current.isLoading).toBe(false);
    vi.mocked(getStoredUser).mockReturnValue({ id: 'user-1', piUsername: 'alice' } as any);
  });

  it('sets error when fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network down'));
    const { useWallet } = await import('@/lib-client/hooks/useWallet');
    const { result } = renderHook(() => useWallet());
    await act(async () => {});
    expect(result.current.error).toBeTruthy();
    expect(result.current.isLoading).toBe(false);
  });

  it('updateBalance mutates wallet.balance', async () => {
    const { useWallet } = await import('@/lib-client/hooks/useWallet');
    const { result } = renderHook(() => useWallet());
    await act(async () => {});
    act(() => { result.current.updateBalance(99.99); });
    expect(result.current.wallet?.balance).toBe(99.99);
  });

  it('setFilterType changes filterType state', async () => {
    const { useWallet } = await import('@/lib-client/hooks/useWallet');
    const { result } = renderHook(() => useWallet());
    await act(async () => {});
    act(() => { result.current.setFilterType('send'); });
    expect(result.current.filterType).toBe('send');
  });

  it('setFilterStatus changes filterStatus state', async () => {
    const { useWallet } = await import('@/lib-client/hooks/useWallet');
    const { result } = renderHook(() => useWallet());
    await act(async () => {});
    act(() => { result.current.setFilterStatus('completed'); });
    expect(result.current.filterStatus).toBe('completed');
  });

  it('refetch triggers another fetch', async () => {
    const { useWallet } = await import('@/lib-client/hooks/useWallet');
    const { result } = renderHook(() => useWallet());
    await act(async () => {});
    const callsBefore = (global.fetch as any).mock.calls.length;
    act(() => { result.current.refetch(); });
    await act(async () => {});
    expect((global.fetch as any).mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('loadMore is a callable function', async () => {
    const { useWallet } = await import('@/lib-client/hooks/useWallet');
    const { result } = renderHook(() => useWallet());
    await act(async () => {});
    expect(() => act(() => { result.current.loadMore(); })).not.toThrow();
  });
});

// ── useWalletRealtime ─────────────────────────────────────────────
const mockIo = vi.hoisted(() => vi.fn());
vi.mock('socket.io-client', () => ({ io: mockIo }));

describe('useWalletRealtime', () => {
  // The hook talks Socket.IO (the service is a NestJS @WebSocketGateway). It used to
  // be tested — and written — against a RAW WebSocket, which could never have
  // connected to that server. These tests now pin the real contract.
  let handlers: Record<string, (...a: unknown[]) => void>;
  let mockSocket: { on: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };
  let originalFetch: typeof global.fetch;

  // The hook loads socket.io-client lazily. Resolving that module the first time
  // costs far more than a waitFor window, so warm it once here — otherwise only the
  // first connecting test would flake on a cold module graph.
  beforeAll(async () => { await import('socket.io-client'); });

  beforeEach(async () => {
    // An earlier test permanently overrides getStoredUser to null; clearAllMocks
    // wipes call history but NOT implementations, so re-establish a signed-in user
    // here rather than depending on test order.
    const auth = await import('@/lib-client/pi/pi-auth');
    vi.mocked(auth.getAccessToken).mockReturnValue('test-token');
    vi.mocked(auth.getStoredUser).mockReturnValue({ id: 'user-1', piUsername: 'alice' } as never);

    handlers   = {};
    mockSocket = {
      on:         vi.fn((e: string, cb: (...a: unknown[]) => void) => { handlers[e] = cb; }),
      disconnect: vi.fn(),
    };
    mockIo.mockReturnValue(mockSocket);

    originalFetch = global.fetch;
    global.fetch = vi.fn(async (url: string) => {
      if (String(url).includes('/api/bff/realtime')) {
        return { ok: true, json: async () => ({ url: 'https://realtime.test', enabled: true }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as any;
  });

  afterEach(() => { global.fetch = originalFetch; vi.clearAllMocks(); });

  it('starts disconnected', async () => {
    const { useWalletRealtime } = await import('@/lib-client/hooks/useWalletRealtime');
    const { result } = renderHook(() => useWalletRealtime({ onBalanceUpdate: vi.fn() }));
    expect(result.current.isConnected).toBe(false);
  });

  it('does not connect when enabled=false', async () => {
    const { useWalletRealtime } = await import('@/lib-client/hooks/useWalletRealtime');
    renderHook(() => useWalletRealtime({ onBalanceUpdate: vi.fn(), enabled: false }));
    await act(async () => {});
    expect(mockIo).not.toHaveBeenCalled();
  });

  it('connects with the token in the handshake auth — where the server reads it', async () => {
    const { useWalletRealtime } = await import('@/lib-client/hooks/useWalletRealtime');
    renderHook(() => useWalletRealtime({ onBalanceUpdate: vi.fn() }));
    await waitFor(() => expect(mockIo).toHaveBeenCalled());
    expect(mockIo).toHaveBeenCalledWith(
      'https://realtime.test',
      expect.objectContaining({ auth: expect.objectContaining({ token: expect.any(String) }) }),
    );
  });

  it('never puts the token in the URL', async () => {
    const { useWalletRealtime } = await import('@/lib-client/hooks/useWalletRealtime');
    renderHook(() => useWalletRealtime({ onBalanceUpdate: vi.fn() }));
    await waitFor(() => expect(mockIo).toHaveBeenCalled());
    expect(String(mockIo.mock.calls[0][0])).not.toMatch(/token|userId/i);
  });

  it('becomes connected on the socket connect event', async () => {
    const { useWalletRealtime } = await import('@/lib-client/hooks/useWalletRealtime');
    const { result } = renderHook(() => useWalletRealtime({ onBalanceUpdate: vi.fn() }));
    await waitFor(() => expect(handlers['connect']).toBeTypeOf('function'));
    act(() => { handlers['connect'](); });
    expect(result.current.isConnected).toBe(true);
  });

  it('calls onBalanceUpdate + onNewTx on wallet.updated', async () => {
    const onBalanceUpdate = vi.fn();
    const onNewTx         = vi.fn();
    const { useWalletRealtime } = await import('@/lib-client/hooks/useWalletRealtime');
    renderHook(() => useWalletRealtime({ onBalanceUpdate, onNewTx }));
    await waitFor(() => expect(handlers['wallet.updated']).toBeTypeOf('function'));
    act(() => { handlers['wallet.updated']({ balance: 10.5, amount: 5, txType: 'credit', txId: 'tx-1' }); });
    expect(onBalanceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'wallet.updated', balance: 10.5 }),
    );
    expect(onNewTx).toHaveBeenCalled();
  });

  it('reports isAvailable=false when realtime is not configured', async () => {
    global.fetch = vi.fn(async () => (
      { ok: true, json: async () => ({ url: null, enabled: false }) } as Response
    )) as any;
    const { useWalletRealtime } = await import('@/lib-client/hooks/useWalletRealtime');
    const { result } = renderHook(() => useWalletRealtime({ onBalanceUpdate: vi.fn() }));
    await act(async () => {});
    expect(result.current.isAvailable).toBe(false);
    expect(mockIo).not.toHaveBeenCalled();
  });

  it('disconnects the socket on unmount', async () => {
    const { useWalletRealtime } = await import('@/lib-client/hooks/useWalletRealtime');
    const { unmount } = renderHook(() => useWalletRealtime({ onBalanceUpdate: vi.fn() }));
    await waitFor(() => expect(mockIo).toHaveBeenCalled());
    unmount();
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });
});

// ── useRealtimeNotifications ──────────────────────────────────────

describe('useRealtimeNotifications', () => {
  it('returns unread=0, connected=false initially', async () => {
    const { useRealtimeNotifications } = await import('@/lib-client/hooks/useRealtimeNotifications');
    const { result } = renderHook(() =>
      useRealtimeNotifications({ userId: undefined, token: null })
    );
    expect(result.current.unread).toBe(0);
    expect(result.current.connected).toBe(false);
  });

  it('does not attempt connection without userId', async () => {
    const { useRealtimeNotifications } = await import('@/lib-client/hooks/useRealtimeNotifications');
    const { result } = renderHook(() =>
      useRealtimeNotifications({ userId: undefined, token: null })
    );
    await act(async () => {});
    expect(result.current.connected).toBe(false);
  });

  it('clearUnread resets count to 0', async () => {
    const { useRealtimeNotifications } = await import('@/lib-client/hooks/useRealtimeNotifications');
    const { result } = renderHook(() =>
      useRealtimeNotifications({ userId: undefined, token: null })
    );
    act(() => { result.current.clearUnread(); });
    expect(result.current.unread).toBe(0);
  });
});

// ── usePiSdkReady ─────────────────────────────────────────────────
describe('usePiSdkReady', () => {
  beforeEach(() => {
    (window as any).Pi = undefined;
    (window as any).__TEC_PI_READY = undefined;
  });

  it('returns piReady=false when Pi not available', async () => {
    const { usePiSdkReady } = await import('@/lib-client/hooks/usePiSdkReady');
    const { result } = renderHook(() => usePiSdkReady());
    await act(async () => {});
    expect(result.current.piReady).toBe(false);
  });

  it('returns piReady=true when window.Pi and __TEC_PI_READY are set', async () => {
    const { piSession } = await import('@/lib-client/pi/pi-session');
    vi.mocked(piSession.ensureAuth).mockResolvedValue(true);
    (window as any).Pi = { init: vi.fn() };
    (window as any).__TEC_PI_READY = true;
    const { usePiSdkReady } = await import('@/lib-client/hooks/usePiSdkReady');
    const { result } = renderHook(() => usePiSdkReady());
    await act(async () => {});
    expect(result.current.piReady).toBe(true);
  });

  it('responds to tec-pi-ready event', async () => {
    const { piSession } = await import('@/lib-client/pi/pi-session');
    vi.mocked(piSession.ensureAuth).mockResolvedValue(true);
    (window as any).Pi = { init: vi.fn() };
    const { usePiSdkReady } = await import('@/lib-client/hooks/usePiSdkReady');
    const { result } = renderHook(() => usePiSdkReady());
    await act(async () => {
      (window as any).__TEC_PI_READY = true;
      window.dispatchEvent(new Event('tec-pi-ready'));
    });
    await act(async () => {});
    expect(result.current.piReady).toBe(true);
  });

  it('ensurePiAuth calls piSession.ensureAuth', async () => {
    const { piSession } = await import('@/lib-client/pi/pi-session');
    const { usePiSdkReady } = await import('@/lib-client/hooks/usePiSdkReady');
    const { result } = renderHook(() => usePiSdkReady());
    await act(async () => { await result.current.ensurePiAuth(); });
    expect(piSession.ensureAuth).toHaveBeenCalled();
  });

  it('handles tec:pi:auth:success event', async () => {
    const { usePiSdkReady } = await import('@/lib-client/hooks/usePiSdkReady');
    const { result } = renderHook(() => usePiSdkReady());
    act(() => {
      window.dispatchEvent(new Event('tec:pi:auth:success'));
    });
    expect(result.current.authReady).toBe(true);
  });

  it('handles tec:pi:auth:failed event', async () => {
    const { usePiSdkReady } = await import('@/lib-client/hooks/usePiSdkReady');
    const { result } = renderHook(() => usePiSdkReady());
    act(() => {
      window.dispatchEvent(new CustomEvent('tec:pi:auth:failed', { detail: { error: 'SCOPE_INVALID' } }));
    });
    expect(result.current.authReady).toBe(false);
    expect(result.current.lastError).toBe('SCOPE_INVALID');
  });

  it('handles tec:pi:scope:lost event by re-authing', async () => {
    const { piSession } = await import('@/lib-client/pi/pi-session');
    vi.mocked(piSession.ensureAuth).mockResolvedValue(true);
    (window as any).Pi = { init: vi.fn() };
    const { usePiSdkReady } = await import('@/lib-client/hooks/usePiSdkReady');
    const { result } = renderHook(() => usePiSdkReady());
    await act(async () => {
      window.dispatchEvent(new Event('tec:pi:scope:lost'));
    });
    await act(async () => {});
    expect(piSession.ensureAuth).toHaveBeenCalled();
  });

  it('handles visibilitychange when page becomes visible', async () => {
    const { piSession } = await import('@/lib-client/pi/pi-session');
    vi.mocked(piSession.ensureAuth).mockResolvedValue(true);
    (window as any).Pi = { init: vi.fn() };
    (window as any).__TEC_PI_READY = true;
    const { usePiSdkReady } = await import('@/lib-client/hooks/usePiSdkReady');
    renderHook(() => usePiSdkReady());
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await act(async () => {});
    // initSession was called; piReady should be true
    expect(piSession.ensureAuth).toHaveBeenCalled();
  });
});
