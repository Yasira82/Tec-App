/**
 * Last-mile lib coverage:
 *   fetch-with-retry retriable loop, health json-warn path,
 *   usePiBrowser 5s timeout fallbacks, PiPaymentButton 30s timeout fallback.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, renderHook, act } from '@testing-library/react';

const mockPiRuntimeIsAvailable = vi.hoisted(() => vi.fn());
vi.mock('@/lib-client/pi/PiRuntime', () => ({
  PiRuntime: {
    isAvailable:   mockPiRuntimeIsAvailable,
    isReady:       vi.fn(() => true),
    init:          vi.fn(),
    authenticate:  vi.fn(),
    createPayment: vi.fn(),
    canAttempt:    vi.fn(() => true),
  },
}));

vi.mock('@/lib-client/pi/pi-session', () => ({
  piSession: {
    ensureAuth:          vi.fn(async () => true),
    ensurePaymentsReady: vi.fn(async () => true),
    acquirePaymentLock:  vi.fn(async () => true),
    releasePaymentLock:  vi.fn(),
    reset:               vi.fn(),
    reInit:              vi.fn(),
    lastError:           null,
  },
  PiAuthError: class PiAuthError extends Error {},
}));

vi.mock('@/lib-client/pi/pi-payment', () => ({
  createU2APayment: vi.fn(async () => ({ success: true, status: 'completed', txid: 't', paymentId: 'p' })),
  testPiSDK:        vi.fn(() => true),
}));

vi.mock('@/lib-client/pi/pi-auth', () => ({
  getAccessToken: vi.fn(() => 'tok'),
  getStoredUser:  vi.fn(() => ({ id: 'u-1' })),
  isPiBrowser:    vi.fn(() => true),
}));

import { fetchWithRetry }     from '@/lib/fetch-with-retry';
import { checkGatewayHealth } from '@/lib-client/api/health';
import { usePiBrowser }       from '@/lib-client/hooks/usePiBrowser';
import PiPaymentButton        from '@/components/payment/PiPaymentButton';

beforeEach(() => {
  vi.clearAllMocks();
  mockPiRuntimeIsAvailable.mockReturnValue(true);
  delete (window as any).Pi;
  delete (window as any).__TEC_PI_READY;
  delete (window as any).__TEC_PI_ERROR;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('fetchWithRetry', () => {
  it('retries retriable statuses with backoff and onRetry callback', async () => {
    const onRetry = vi.fn();
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true,  status: 200 });
    const res = await fetchWithRetry('http://x/api', { maxRetries: 3, baseDelay: 1, onRetry });
    expect(res.status).toBe(200);
    expect(onRetry).toHaveBeenCalledWith(1, expect.objectContaining({ message: 'HTTP 503' }));
  });

  it('returns the final retriable response when maxRetries is exhausted', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 502 });
    const res = await fetchWithRetry('http://x/api', { maxRetries: 2, baseDelay: 1 });
    expect(res.status).toBe(502);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('retries network errors and throws the last one', async () => {
    const onRetry = vi.fn();
    global.fetch = vi.fn().mockRejectedValue(new Error('conn refused'));
    await expect(
      fetchWithRetry('http://x/api', { maxRetries: 2, baseDelay: 1, onRetry }),
    ).rejects.toThrow('conn refused');
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('wraps non-Error throw values', async () => {
    global.fetch = vi.fn().mockRejectedValue('plain failure');
    await expect(
      fetchWithRetry('http://x/api', { maxRetries: 1, baseDelay: 1 }),
    ).rejects.toThrow('Network error');
  });
});

describe('checkGatewayHealth', () => {
  it('returns online with services on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ services: { auth: 'up' } }),
    });
    expect(await checkGatewayHealth()).toEqual({ online: true, services: { auth: 'up' } });
  });

  it('warns and treats unreadable body as empty (still online)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => { throw new Error('not json'); },
    });
    const result = await checkGatewayHealth();
    expect(result.online).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('offline on non-ok and on network error', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    expect((await checkGatewayHealth()).online).toBe(false);
    global.fetch = vi.fn().mockRejectedValue(new Error('down'));
    expect((await checkGatewayHealth()).online).toBe(false);
  });
});

describe('usePiBrowser 5s timeout fallbacks', () => {
  const setUA = (ua: string) =>
    Object.defineProperty(navigator, 'userAgent', {
      value: ua, writable: true, configurable: true,
    });

  it('non-Pi UA: timeout re-checks window.Pi and resolves ready', async () => {
    vi.useFakeTimers();
    setUA('Mozilla/5.0 (X11; Linux) Chrome/120');
    const { result } = renderHook(() => usePiBrowser());
    (window as any).Pi = { authenticate: vi.fn() };
    await act(async () => { vi.advanceTimersByTime(5100); });
    expect(result.current.isReady).toBe(true);
    expect(result.current.isPiBrowser).toBe(true);
  });

  it('Pi UA: timeout marks ready as Pi Browser', async () => {
    vi.useFakeTimers();
    setUA('PiBrowser/2.0 (Android)');
    const { result } = renderHook(() => usePiBrowser());
    await act(async () => { vi.advanceTimersByTime(5100); });
    expect(result.current.isReady).toBe(true);
    expect(result.current.isPiBrowser).toBe(true);
  });
});

describe('PiPaymentButton 30s timeout fallback', () => {
  it('marks sdkReady via PiRuntime.isAvailable after the 30s timeout', async () => {
    vi.useFakeTimers();
    delete (window as any).__TEC_PI_READY;
    mockPiRuntimeIsAvailable.mockReturnValue(true);
    const { container } = render(<PiPaymentButton amount={1} memo="m" />);
    await act(async () => { vi.advanceTimersByTime(30_500); });
    expect(container.querySelector('button')).toBeTruthy();
  });
});
