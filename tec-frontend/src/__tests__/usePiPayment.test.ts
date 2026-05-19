/**
 * Smoke tests for usePiPayment hook with mocked Pi SDK.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---- mock Pi SDK modules ----
vi.mock('@/lib-client/pi/pi-payment', () => ({
  createU2APayment:         vi.fn(),
  preCreateInternalPayment: vi.fn(async () => 'internal-id-1'),
  testPiSDK:                vi.fn(() => false),
}));

vi.mock('@/lib-client/pi/pi-auth', () => ({
  isPiBrowser: vi.fn(() => false),
}));

import { usePiPayment } from '@/lib-client/hooks/usePiPayment';
import * as piPayment from '@/lib-client/pi/pi-payment';

describe('usePiPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => usePiPayment());

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.lastPayment).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.errorType).toBeNull();
  });

  it('sets processing state during payment', async () => {
    let resolvePayment!: (v: Awaited<ReturnType<typeof piPayment.createU2APayment>>) => void;
    vi.mocked(piPayment.createU2APayment).mockReturnValue(
      new Promise((r) => {
        resolvePayment = r;
      })
    );

    const { result } = renderHook(() => usePiPayment());

    act(() => {
      result.current.payDemoPi();
    });

    expect(result.current.isProcessing).toBe(true);

    await act(async () => {
      resolvePayment({
        success: true,
        paymentId: 'pay-1',
        txid: 'tx-1',
        status: 'completed',
        amount: 1,
        memo: 'TEC Demo Payment - 1 Pi',
        message: 'Payment successful! 🎉',
      });
    });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.lastPayment?.status).toBe('completed');
  });

  it('handles payment error', async () => {
    vi.mocked(piPayment.createU2APayment).mockRejectedValue(
      new Error('Pi SDK not available - Open in Pi Browser')
    );

    const { result } = renderHook(() => usePiPayment());

    await act(async () => {
      try {
        await result.current.payDemoPi();
      } catch {
        // expected
      }
    });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.error).toContain('Pi SDK');
    expect(result.current.errorType).toBe('not_pi_browser');
  });

  it('handles timeout error type', async () => {
    vi.mocked(piPayment.createU2APayment).mockRejectedValue(
      new Error('Payment approval timed out. Please try again.')
    );

    const { result } = renderHook(() => usePiPayment());

    await act(async () => {
      try {
        await result.current.payDemoPi();
      } catch {
        // expected
      }
    });

    expect(result.current.errorType).toBe('timeout');
  });

  it('resetPayment clears error and lastPayment', async () => {
    vi.mocked(piPayment.createU2APayment).mockRejectedValue(new Error('some error'));

    const { result } = renderHook(() => usePiPayment());

    await act(async () => {
      try {
        await result.current.payDemoPi();
      } catch {
        // expected
      }
    });

    expect(result.current.error).toBeTruthy();

    act(() => {
      result.current.resetPayment();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.lastPayment).toBeNull();
  });
});
