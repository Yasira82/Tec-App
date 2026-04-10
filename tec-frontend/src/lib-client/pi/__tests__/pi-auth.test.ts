// ✅ Mock sdk قبل أي import تاني
vi.mock('@/lib/sdk', () => ({
  default: {
    clearAuthToken: vi.fn(),
    payment: {
      resolveIncomplete: vi.fn(),
    },
  },
}));

import { isPiBrowser, getAccessToken, getStoredUser, getRefreshToken } from '../pi-auth';
import { vi } from 'vitest';

describe('pi-auth', () => {

  describe('isPiBrowser', () => {
    it('returns false when window.Pi is undefined', () => {
      // @ts-expect-error — delete for test
      delete window.Pi;
      expect(isPiBrowser()).toBe(false);
    });

    it('returns true when window.Pi.authenticate exists', () => {
      Object.defineProperty(window, 'Pi', {
        value:        { authenticate: vi.fn(), createPayment: vi.fn(), init: vi.fn() },
        writable:     true,
        configurable: true,
      });
      expect(isPiBrowser()).toBe(true);
    });

    it('returns false when window.Pi.authenticate is not a function', () => {
      Object.defineProperty(window, 'Pi', {
        value:        { authenticate: 'not-a-function' },
        writable:     true,
        configurable: true,
      });
      expect(isPiBrowser()).toBe(false);
    });
  });

  describe('getRefreshToken', () => {
    it('always returns null', () => {
      expect(getRefreshToken()).toBeNull();
    });
  });

  describe('getAccessToken', () => {
    it('returns null when cookie is not set', () => {
      Object.defineProperty(document, 'cookie', {
        get:          () => '',
        configurable: true,
      });
      expect(getAccessToken()).toBeNull();
    });

    it('returns token when tec_access_token cookie exists', () => {
      Object.defineProperty(document, 'cookie', {
        get:          () => 'tec_access_token=my-access-token; other=value',
        configurable: true,
      });
      expect(getAccessToken()).toBe('my-access-token');
    });

    it('returns null when only other cookies exist', () => {
      Object.defineProperty(document, 'cookie', {
        get:          () => 'other_cookie=some-value',
        configurable: true,
      });
      expect(getAccessToken()).toBeNull();
    });
  });

  describe('getStoredUser', () => {
    it('returns null when tec_user cookie is not set', () => {
      Object.defineProperty(document, 'cookie', {
        get:          () => '',
        configurable: true,
      });
      expect(getStoredUser()).toBeNull();
    });

    it('returns parsed user when cookie exists', () => {
      const user = { id: 'user-1', piUsername: 'testuser' };
      Object.defineProperty(document, 'cookie', {
        get:          () => `tec_user=${encodeURIComponent(JSON.stringify(user))}`,
        configurable: true,
      });
      expect(getStoredUser()).toEqual(user);
    });

    it('returns null when cookie value is invalid JSON', () => {
      Object.defineProperty(document, 'cookie', {
        get:          () => 'tec_user=invalid-json',
        configurable: true,
      });
      expect(getStoredUser()).toBeNull();
    });
  });
});
