import { testPiSDK } from '../pi-payment';

describe('pi-payment', () => {

  describe('testPiSDK', () => {
    it('returns false when window.Pi is not defined', () => {
      // @ts-expect-error — delete for test
      delete window.Pi;
      expect(testPiSDK()).toBe(false);
    });

    it('returns true when window.Pi is defined', () => {
      Object.defineProperty(window, 'Pi', {
        value: { authenticate: jest.fn(), createPayment: jest.fn(), init: jest.fn() },
        writable: true,
        configurable: true,
      });
      expect(testPiSDK()).toBe(true);
    });
  });
});
