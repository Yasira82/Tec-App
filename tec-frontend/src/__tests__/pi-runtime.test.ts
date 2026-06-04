import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib-client/pi/pi-session', () => ({
  piSession: {
    reInit:              vi.fn(),
    reset:               vi.fn(),
    ensurePaymentsReady: vi.fn().mockResolvedValue(true),
    acquirePaymentLock:  vi.fn().mockResolvedValue(true),
    releasePaymentLock:  vi.fn(),
    lastError:           null,
    lastRawError:        null,
  },
}));

vi.mock('@/lib-client/pi/pi-auth', () => ({
  loginWithPi:    vi.fn(),
  getAccessToken: vi.fn(),
  getStoredUser:  vi.fn(),
  isPiBrowser:    vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib-client/pi/pi-payment', () => ({
  createU2APayment: vi.fn(),
  createA2UPayment: vi.fn(),
  getPaymentStatus: vi.fn(),
}));

const mockCanAttempt = vi.fn().mockReturnValue(true);
const mockOnSuccess  = vi.fn();
const mockOnFailure  = vi.fn();
const mockStats      = vi.fn().mockReturnValue({ state: 'CLOSED', failures: 0, secondsTillRecovery: 0 });

vi.mock('@/lib-client/pi/PiCircuitBreaker', () => ({
  piCircuitBreaker: {
    canAttempt:   mockCanAttempt,
    onSuccess:    mockOnSuccess,
    onFailure:    mockOnFailure,
    stats:        mockStats,
    currentState: 'CLOSED',
    reset:        vi.fn(),
  },
}));

import { PiRuntime }        from '@/lib-client/pi/PiRuntime';
import { createU2APayment } from '@/lib-client/pi/pi-payment';

describe('PiRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanAttempt.mockReturnValue(true);
    mockStats.mockReturnValue({ state: 'CLOSED', failures: 0, secondsTillRecovery: 0 });
  });

  // ── isAvailable() ────────────────────────────────────────
  describe('isAvailable()', () => {
    it('returns false when window.Pi is not defined', () => {
      const orig = (window as any).Pi;
      delete (window as any).Pi;
      expect(PiRuntime.isAvailable()).toBe(false);
      (window as any).Pi = orig;
    });

    it('returns true when window.Pi is defined', () => {
      (window as any).Pi = { createPayment: vi.fn() };
      expect(PiRuntime.isAvailable()).toBe(true);
      delete (window as any).Pi;
    });
  });

  // ── isReady() ────────────────────────────────────────────
  describe('isReady()', () => {
    afterEach(() => {
      delete (window as any).Pi;
      delete (window as any).__TEC_PI_READY;
    });

    it('returns false when __TEC_PI_READY is not set', () => {
      (window as any).Pi = { createPayment: vi.fn() };
      delete (window as any).__TEC_PI_READY;
      expect(PiRuntime.isReady()).toBe(false);
    });

    it('returns false when window.Pi is not set', () => {
      delete (window as any).Pi;
      (window as any).__TEC_PI_READY = true;
      expect(PiRuntime.isReady()).toBe(false);
    });

    it('returns true when both Pi and __TEC_PI_READY are set', () => {
      (window as any).Pi = { createPayment: vi.fn() };
      (window as any).__TEC_PI_READY = true;
      expect(PiRuntime.isReady()).toBe(true);
    });
  });

  // ── createU2APayment — circuit breaker integration ───────
  describe('createU2APayment()', () => {
    it('returns error immediately when circuit is OPEN', async () => {
      mockCanAttempt.mockReturnValue(false);
      mockStats.mockReturnValue({ state: 'OPEN', failures: 3, secondsTillRecovery: 45 });

      const result = await PiRuntime.createU2APayment(1, 'test');
      expect(result.success).toBe(false);
      expect(result.status).toBe('error');
      expect(result.message).toContain('45s');
      expect(createU2APayment).not.toHaveBeenCalled();
    });

    it('message says "please try again" when secondsTillRecovery is 0', async () => {
      mockCanAttempt.mockReturnValue(false);
      mockStats.mockReturnValue({ state: 'OPEN', failures: 3, secondsTillRecovery: 0 });

      const result = await PiRuntime.createU2APayment(1, 'test');
      expect(result.message).toContain('please try again');
    });

    it('delegates to createU2APayment when circuit allows', async () => {
      vi.mocked(createU2APayment).mockResolvedValue({
        success: true, status: 'completed', amount: 1, memo: 'test',
      });
      await PiRuntime.createU2APayment(1, 'test');
      expect(createU2APayment).toHaveBeenCalledWith(1, 'test', {}, undefined, undefined);
    });

    it('passes metadata, internalId through to underlying function', async () => {
      vi.mocked(createU2APayment).mockResolvedValue({
        success: true, status: 'completed', amount: 5, memo: 'cart',
      });
      const meta = { source: 'cart', items: 3 };
      await PiRuntime.createU2APayment(5, 'cart', meta, 'internal-id-abc');
      expect(createU2APayment).toHaveBeenCalledWith(5, 'cart', meta, 'internal-id-abc', undefined);
    });

    it('calls onSuccess when payment completes', async () => {
      vi.mocked(createU2APayment).mockResolvedValue({
        success: true, status: 'completed', amount: 1, memo: 'test',
      });
      await PiRuntime.createU2APayment(1, 'test');
      expect(mockOnSuccess).toHaveBeenCalledOnce();
      expect(mockOnFailure).not.toHaveBeenCalled();
    });

    it('calls onFailure when payment has error status', async () => {
      vi.mocked(createU2APayment).mockResolvedValue({
        success: false, status: 'error', amount: 1, memo: 'test', message: 'SDK error',
      });
      await PiRuntime.createU2APayment(1, 'test');
      expect(mockOnFailure).toHaveBeenCalledOnce();
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it('calls neither onSuccess nor onFailure when payment is cancelled', async () => {
      vi.mocked(createU2APayment).mockResolvedValue({
        success: false, status: 'cancelled', amount: 1, memo: 'test',
      });
      await PiRuntime.createU2APayment(1, 'test');
      expect(mockOnSuccess).not.toHaveBeenCalled();
      expect(mockOnFailure).not.toHaveBeenCalled();
    });
  });
});
