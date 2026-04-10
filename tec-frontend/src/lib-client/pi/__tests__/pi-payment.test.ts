import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/sdk', () => ({
  default: {
    clearAuthToken: vi.fn(),
    payment: {
      resolveIncomplete: vi.fn(),
      getPayment:        vi.fn(),
    },
  },
}));

vi.mock('@/lib/request-id', () => ({
  buildHeaders:      vi.fn(() => ({ 'Content-Type': 'application/json' })),
  generateRequestId: vi.fn(() => 'test-uuid'),
  storeRequestId:    vi.fn(),
}));

vi.mock('../pi-auth', () => ({
  isPiBrowser:    vi.fn(() => true),
  getAccessToken: vi.fn(() => 'test-token'),
  getStoredUser:  vi.fn(() => ({ id: 'user-1', piUsername: 'testuser' })),
  getRefreshToken: vi.fn(() => null),
  waitForPiSDK:   vi.fn(() => Promise.resolve()),
}));

import { testPiSDK } from '../pi-payment';

describe('pi-payment', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('testPiSDK', () => {
    it('returns false when window.Pi is not defined', () => {
      // @ts-expect-error
      delete window.Pi;
      expect(testPiSDK()).toBe(false);
    });

    it('returns true when window.Pi is defined', () => {
      Object.defineProperty(window, 'Pi', {
        value:        { authenticate: vi.fn(), createPayment: vi.fn(), init: vi.fn() },
        writable:     true,
        configurable: true,
      });
      expect(testPiSDK()).toBe(true);
    });
  });
});
