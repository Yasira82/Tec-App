/**
 * usePiPayment — error-type classification branches (lines 74,76,96-100)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockCreateU2APayment = vi.hoisted(() => vi.fn());
const mockTestPiSDK        = vi.hoisted(() => vi.fn(() => true));

vi.mock('@/lib-client/pi/pi-payment', () => ({
  createU2APayment: mockCreateU2APayment,
  testPiSDK:        mockTestPiSDK,
}));

vi.mock('@/lib-client/pi/pi-auth', () => ({
  isPiBrowser: vi.fn(() => false),
}));

import { usePiPayment } from '@/lib-client/hooks/usePiPayment';

beforeEach(() => {
  mockCreateU2APayment.mockReset();
  mockTestPiSDK.mockReset().mockReturnValue(true);
});

const expectErrorType = async (errMessage: string, expectedType: string) => {
  mockCreateU2APayment.mockRejectedValue(new Error(errMessage));
  const onDiagnostic = vi.fn();
  const { result } = renderHook(() => usePiPayment({ onDiagnostic }));
  await act(async () => {
    await expect(result.current.payDemoPi(1)).rejects.toThrow();
  });
  expect(result.current.errorType).toBe(expectedType);
  expect(result.current.error).toBe(errMessage);
  expect(onDiagnostic).toHaveBeenCalledWith('error', errMessage, { errorType: expectedType });
};

describe('usePiPayment errorType classification', () => {
  it('classifies "Pi Browser" errors as not_pi_browser', async () => {
    await expectErrorType('Open in Pi Browser please', 'not_pi_browser');
  });

  it('classifies "timed out" errors as timeout', async () => {
    await expectErrorType('Request timed out after 60s', 'timeout');
  });

  it('classifies Arabic timeout (انتهت مهلة) as timeout', async () => {
    await expectErrorType('انتهت مهلة العملية', 'timeout');
  });

  it('classifies "Approval" errors as approval_failed', async () => {
    await expectErrorType('Approval failed on server', 'approval_failed');
  });

  it('classifies Arabic approval (الموافقة) as approval_failed', async () => {
    await expectErrorType('فشلت الموافقة على الدفع', 'approval_failed');
  });

  it('classifies "Completion" errors as completion_failed', async () => {
    await expectErrorType('Completion failed on server', 'completion_failed');
  });

  it('classifies Arabic completion (الإكمال) as completion_failed', async () => {
    await expectErrorType('فشل الإكمال', 'completion_failed');
  });

  it('falls back to sdk_error for unknown messages', async () => {
    await expectErrorType('something exploded', 'sdk_error');
  });

  it('non-Error throw uses fallback Arabic message', async () => {
    mockCreateU2APayment.mockRejectedValue('plain string failure');
    const { result } = renderHook(() => usePiPayment());
    await act(async () => {
      await expect(result.current.payDemoPi(1)).rejects.toBeDefined();
    });
    expect(result.current.error).toBe('فشل الدفع');
    expect(result.current.errorType).toBe('sdk_error');
  });

  it('resetPayment clears error state after a failure', async () => {
    mockCreateU2APayment.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => usePiPayment());
    await act(async () => {
      await expect(result.current.payDemoPi(1)).rejects.toThrow();
    });
    expect(result.current.error).toBe('boom');
    act(() => { result.current.resetPayment(); });
    expect(result.current.error).toBeNull();
    expect(result.current.errorType).toBeNull();
    expect(result.current.lastPayment).toBeNull();
  });
});
