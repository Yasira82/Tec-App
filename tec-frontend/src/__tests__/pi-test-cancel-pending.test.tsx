/**
 * PiTestClient — Cancel Pending incomplete-payment callback paths
 * (lines 157-172: pending found → resolve ok / resolve !ok / network error,
 *  and no-identifier → "No pending payment").
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react';

const mockIsPiBrowser          = vi.hoisted(() => vi.fn());
const mockGetAccessToken       = vi.hoisted(() => vi.fn());
const mockPiRuntimeIsAvailable = vi.hoisted(() => vi.fn());

vi.mock('@/lib-client/pi/pi-auth', () => ({
  isPiBrowser:    mockIsPiBrowser,
  loginWithPi:    vi.fn(),
  getStoredUser:  vi.fn(() => null),
  getAccessToken: mockGetAccessToken,
  logout:         vi.fn(),
}));

vi.mock('@/lib-client/pi/pi-payment', () => ({
  createU2APayment: vi.fn(),
  testPiSDK:        vi.fn(() => true),
}));

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

import { PiTestClient } from '@/app/pi-test/PiTestClient';

const clickCancelPending = (container: HTMLElement) => {
  const btn = Array.from(container.querySelectorAll('button'))
    .find(b => b.textContent?.includes('Cancel Pending'))!;
  fireEvent.click(btn);
};

let incompleteCb: ((payment: unknown) => Promise<void>) | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  incompleteCb = null;
  mockIsPiBrowser.mockReturnValue(true);
  mockPiRuntimeIsAvailable.mockReturnValue(true);
  mockGetAccessToken.mockReturnValue('tok-1');
  (window as any).__TEC_PI_READY = true;
  delete (window as any).__TEC_PI_ERROR;
  (window as any).Pi = {
    authenticate: vi.fn(async (_scopes: string[], cb: (p: unknown) => Promise<void>) => {
      incompleteCb = cb;
      return { accessToken: 'pi-tok', user: { username: 'alice' } };
    }),
  };
  Object.defineProperty(document, 'cookie', {
    writable: true, configurable: true,
    value: 'tec_csrf=csrf-1',
  });
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true, status: 200, json: async () => ({ action: 'resolved' }),
  } as Response);
});

describe('PiTestClient Cancel Pending', () => {
  it('logs "No pending payment" when callback gets payment without identifier', async () => {
    const { container } = render(<PiTestClient />);
    clickCancelPending(container);
    await waitFor(() => expect(incompleteCb).not.toBeNull());
    await act(async () => { await incompleteCb!({}); });
    await waitFor(() => {
      expect(container.textContent).toContain('No pending payment');
    });
  });

  it('resolves pending payment via backend and logs success', async () => {
    const { container } = render(<PiTestClient />);
    clickCancelPending(container);
    await waitFor(() => expect(incompleteCb).not.toBeNull());
    await act(async () => {
      await incompleteCb!({ identifier: 'pi-pend-1', amount: 2 });
    });
    await waitFor(() => {
      expect(container.textContent).toContain('Pending: pi-pend-1');
      expect(container.textContent).toContain('Resolve:');
    });
    const call = (globalThis.fetch as any).mock.calls.find(
      (c: any[]) => String(c[0]).includes('resolve-incomplete'),
    );
    expect(call).toBeTruthy();
    expect(call[1].headers['Authorization']).toBe('Bearer tok-1');
    expect(call[1].headers['x-csrf-token']).toBe('csrf-1');
  });

  it('logs error status when resolve endpoint returns !ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false, status: 409, json: async () => ({ message: 'terminal state' }),
    } as Response);
    const { container } = render(<PiTestClient />);
    clickCancelPending(container);
    await waitFor(() => expect(incompleteCb).not.toBeNull());
    await act(async () => {
      await incompleteCb!({ identifier: 'pi-pend-2', amount: 1 });
    });
    await waitFor(() => {
      expect(container.textContent).toContain('(409)');
    });
  });

  it('logs network error when resolve fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const { container } = render(<PiTestClient />);
    clickCancelPending(container);
    await waitFor(() => expect(incompleteCb).not.toBeNull());
    await act(async () => {
      await incompleteCb!({ identifier: 'pi-pend-3', amount: 1 });
    });
    await waitFor(() => {
      expect(container.textContent).toContain('Network:');
    });
  });

  it('omits auth headers when token and csrf cookie are absent', async () => {
    mockGetAccessToken.mockReturnValue(null);
    Object.defineProperty(document, 'cookie', {
      writable: true, configurable: true, value: '',
    });
    const { container } = render(<PiTestClient />);
    clickCancelPending(container);
    await waitFor(() => expect(incompleteCb).not.toBeNull());
    await act(async () => {
      await incompleteCb!({ identifier: 'pi-pend-4', amount: 1 });
    });
    const call = (globalThis.fetch as any).mock.calls.find(
      (c: any[]) => String(c[0]).includes('resolve-incomplete'),
    );
    expect(call[1].headers).toEqual({});
  });
});
