import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { piCircuitBreaker } from '@/lib-client/pi/PiCircuitBreaker';

describe('PiCircuitBreaker', () => {
  beforeEach(() => {
    localStorage.clear();
    piCircuitBreaker.reset();
  });

  // ── initial state ────────────────────────────────────────
  describe('initial state', () => {
    it('starts CLOSED', () => {
      expect(piCircuitBreaker.currentState).toBe('CLOSED');
    });

    it('canAttempt() is true when CLOSED', () => {
      expect(piCircuitBreaker.canAttempt()).toBe(true);
    });

    it('stats() returns zero failures and zero recovery time', () => {
      const s = piCircuitBreaker.stats();
      expect(s.state).toBe('CLOSED');
      expect(s.failures).toBe(0);
      expect(s.secondsTillRecovery).toBe(0);
    });
  });

  // ── failure accumulation ─────────────────────────────────
  describe('failure accumulation', () => {
    it('stays CLOSED after 1 failure', () => {
      piCircuitBreaker.onFailure();
      expect(piCircuitBreaker.currentState).toBe('CLOSED');
      expect(piCircuitBreaker.canAttempt()).toBe(true);
    });

    it('stays CLOSED after 2 failures', () => {
      piCircuitBreaker.onFailure();
      piCircuitBreaker.onFailure();
      expect(piCircuitBreaker.currentState).toBe('CLOSED');
      expect(piCircuitBreaker.canAttempt()).toBe(true);
    });

    it('opens after 3 consecutive failures', () => {
      piCircuitBreaker.onFailure();
      piCircuitBreaker.onFailure();
      piCircuitBreaker.onFailure();
      expect(piCircuitBreaker.currentState).toBe('OPEN');
    });

    it('canAttempt() is false when OPEN', () => {
      piCircuitBreaker.onFailure();
      piCircuitBreaker.onFailure();
      piCircuitBreaker.onFailure();
      expect(piCircuitBreaker.canAttempt()).toBe(false);
    });

    it('onSuccess() resets failures counter to zero', () => {
      piCircuitBreaker.onFailure();
      piCircuitBreaker.onFailure();
      piCircuitBreaker.onSuccess();
      expect(piCircuitBreaker.currentState).toBe('CLOSED');
      expect(piCircuitBreaker.stats().failures).toBe(0);
    });

    it('stats() returns positive secondsTillRecovery when OPEN', () => {
      piCircuitBreaker.onFailure();
      piCircuitBreaker.onFailure();
      piCircuitBreaker.onFailure();
      const { secondsTillRecovery } = piCircuitBreaker.stats();
      expect(secondsTillRecovery).toBeGreaterThan(0);
      expect(secondsTillRecovery).toBeLessThanOrEqual(60);
    });

    it('stats() returns 0 secondsTillRecovery when CLOSED', () => {
      expect(piCircuitBreaker.stats().secondsTillRecovery).toBe(0);
    });
  });

  // ── OPEN → HALF_OPEN via fake timers ─────────────────────
  describe('OPEN → HALF_OPEN transition', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      piCircuitBreaker.onFailure();
      piCircuitBreaker.onFailure();
      piCircuitBreaker.onFailure();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('stays OPEN before 60s timeout', () => {
      vi.advanceTimersByTime(59_999);
      expect(piCircuitBreaker.currentState).toBe('OPEN');
    });

    it('transitions to HALF_OPEN after 60s timeout', () => {
      vi.advanceTimersByTime(60_001);
      expect(piCircuitBreaker.currentState).toBe('HALF_OPEN');
    });

    it('canAttempt() is true in HALF_OPEN', () => {
      vi.advanceTimersByTime(60_001);
      expect(piCircuitBreaker.canAttempt()).toBe(true);
    });

    it('closes after success in HALF_OPEN', () => {
      vi.advanceTimersByTime(60_001);
      piCircuitBreaker.onSuccess();
      expect(piCircuitBreaker.currentState).toBe('CLOSED');
    });
  });

  // ── reset ────────────────────────────────────────────────
  describe('reset()', () => {
    it('clears OPEN state back to CLOSED', () => {
      piCircuitBreaker.onFailure();
      piCircuitBreaker.onFailure();
      piCircuitBreaker.onFailure();
      piCircuitBreaker.reset();
      expect(piCircuitBreaker.currentState).toBe('CLOSED');
      expect(piCircuitBreaker.stats().failures).toBe(0);
    });
  });

  // ── localStorage edge cases ───────────────────────────────
  describe('localStorage resilience', () => {
    it('persists OPEN state across multiple reads', () => {
      piCircuitBreaker.onFailure();
      piCircuitBreaker.onFailure();
      piCircuitBreaker.onFailure();
      expect(piCircuitBreaker.currentState).toBe('OPEN');
      expect(piCircuitBreaker.currentState).toBe('OPEN');
    });

    it('recovers gracefully from corrupt localStorage data', () => {
      localStorage.setItem('tec_pi_cb', 'not-valid-json{{{');
      expect(piCircuitBreaker.currentState).toBe('CLOSED');
      expect(piCircuitBreaker.canAttempt()).toBe(true);
    });

    it('treats missing localStorage key as CLOSED', () => {
      localStorage.removeItem('tec_pi_cb');
      expect(piCircuitBreaker.currentState).toBe('CLOSED');
    });
  });
});
