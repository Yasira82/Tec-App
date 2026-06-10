/**
 * Coverage for:
 *   app/hub/pay/page.tsx — query param forwarding to /hub?pay=1
 *   usePiSdkReady — poll path, 15s timeout fallback, scope-lost re-auth guard
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, renderHook, act, waitFor } from '@testing-library/react';

const mockRouterReplace = vi.hoisted(() => vi.fn());
const mockParamsGet     = vi.hoisted(() => vi.fn((_k: string) => null as string | null));

vi.mock('next/navigation', () => ({
  useRouter:       () => ({ push: vi.fn(), back: vi.fn(), replace: mockRouterReplace }),
  usePathname:     () => '/hub/pay',
  useSearchParams: () => ({ get: mockParamsGet }),
}));

const mockEnsureAuth = vi.hoisted(() => vi.fn());
vi.mock('@/lib-client/pi/pi-session', () => ({
  piSession: {
    ensureAuth:          mockEnsureAuth,
    ensurePaymentsReady: vi.fn(() => Promise.resolve(true)),
    reset:               vi.fn(),
    reInit:              vi.fn(),
    lastError:           null,
  },
  PiAuthError: class PiAuthError extends Error {},
}));

import HubPayPage        from '@/app/hub/pay/page';
import { usePiSdkReady } from '@/lib-client/hooks/usePiSdkReady';

beforeEach(() => {
  mockRouterReplace.mockClear();
  mockParamsGet.mockReturnValue(null);
  mockEnsureAuth.mockResolvedValue(true);
  delete (window as any).Pi;
  delete (window as any).__TEC_PI_READY;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('HubPayPage redirect', () => {
  it('redirects to /hub?pay=1 with no extra params', async () => {
    render(<HubPayPage />);
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled());
    expect(mockRouterReplace).toHaveBeenCalledWith('/hub?pay=1');
  });

  it('forwards amount, memo, return_url, product_id, source params', async () => {
    const map: Record<string, string> = {
      amount: '5', memo: 'Tea', return_url: 'https://x/y',
      product_id: 'p-1', source: 'commerce',
    };
    mockParamsGet.mockImplementation((k: string) => map[k] ?? null);
    render(<HubPayPage />);
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled());
    const target = mockRouterReplace.mock.calls[0][0] as string;
    expect(target).toContain('pay=1');
    expect(target).toContain('amount=5');
    expect(target).toContain('memo=Tea');
    expect(target).toContain('product_id=p-1');
    expect(target).toContain('source=commerce');
    expect(target).toContain('return_url=');
  });
});

describe('usePiSdkReady — poll and timeout fallback', () => {
  it('poll detects Pi appearing after mount', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePiSdkReady());
    expect(result.current.piReady).toBe(false);

    (window as any).Pi = { authenticate: vi.fn() };
    (window as any).__TEC_PI_READY = true;
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(result.current.piReady).toBe(true);
  });

  it('15s timeout falls back to initSession when window.Pi exists without ready flag', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePiSdkReady());
    // Pi present but __TEC_PI_READY never set → poll never fires, timeout does
    (window as any).Pi = { authenticate: vi.fn() };
    await act(async () => { vi.advanceTimersByTime(15_100); });
    expect(result.current.piReady).toBe(true);
  });

  it('15s timeout without window.Pi leaves piReady false', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePiSdkReady());
    await act(async () => { vi.advanceTimersByTime(15_100); });
    expect(result.current.piReady).toBe(false);
  });

  it('scope-lost event triggers re-auth once (guard blocks concurrent)', async () => {
    (window as any).Pi = { authenticate: vi.fn() };
    (window as any).__TEC_PI_READY = true;
    let resolveAuth!: (v: boolean) => void;
    mockEnsureAuth.mockReturnValue(new Promise<boolean>(r => { resolveAuth = r; }));

    const { result } = renderHook(() => usePiSdkReady());
    await act(async () => {});

    // Fire scope:lost twice — second must be ignored by isReauthing guard
    act(() => {
      window.dispatchEvent(new Event('tec:pi:scope:lost'));
      window.dispatchEvent(new Event('tec:pi:scope:lost'));
    });
    await act(async () => { resolveAuth(true); });
    await waitFor(() => expect(result.current.authReady).toBe(true));
  });

  it('auth:failed event sets lastError from detail', async () => {
    (window as any).Pi = { authenticate: vi.fn() };
    (window as any).__TEC_PI_READY = true;
    const { result } = renderHook(() => usePiSdkReady());
    await act(async () => {});
    act(() => {
      window.dispatchEvent(new CustomEvent('tec:pi:auth:failed', { detail: { error: 'SCOPE_DENIED' } }));
    });
    expect(result.current.authReady).toBe(false);
    expect(result.current.lastError).toBe('SCOPE_DENIED');
  });

  it('auth:failed without detail falls back to UNKNOWN', async () => {
    (window as any).Pi = { authenticate: vi.fn() };
    (window as any).__TEC_PI_READY = true;
    const { result } = renderHook(() => usePiSdkReady());
    await act(async () => {});
    act(() => {
      window.dispatchEvent(new Event('tec:pi:auth:failed'));
    });
    expect(result.current.lastError).toBe('UNKNOWN');
  });
});
