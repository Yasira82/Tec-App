import { TecAuthSDK } from '../src/auth';
import { TecApiClient } from '../src/client';
import { storage, STORAGE_KEYS } from '../src/utils/storage';
import { isPiBrowser } from '../src/utils/pi-browser';

jest.mock('../src/utils/storage');
jest.mock('../src/utils/pi-browser');
jest.mock('../src/client');

describe('TecAuthSDK', () => {
  let authSDK: TecAuthSDK;
  let mockClient: jest.Mocked<TecApiClient>;

  beforeEach(() => {
    mockClient = {
      post: jest.fn(),
      get: jest.fn(),
    } as unknown as jest.Mocked<TecApiClient>;
    authSDK = new TecAuthSDK(mockClient);
    jest.clearAllMocks();
  });

  describe('getStoredUser', () => {
    it('should return stored user from storage', () => {
      const mockUser = {
        id: '1',
        piId: 'pi123',
        piUsername: 'testuser',
        role: 'user',
        subscriptionPlan: null,
        createdAt: '2024-01-01',
      };
      (storage.getJSON as jest.Mock).mockReturnValue(mockUser);

      const user = authSDK.getStoredUser();

      expect(storage.getJSON).toHaveBeenCalledWith(STORAGE_KEYS.USER);
      expect(user).toEqual(mockUser);
    });

    it('should return null if no user stored', () => {
      (storage.getJSON as jest.Mock).mockReturnValue(null);

      const user = authSDK.getStoredUser();

      expect(user).toBeNull();
    });
  });

  describe('getAccessToken', () => {
    it('should return access token from storage', () => {
      (storage.get as jest.Mock).mockReturnValue('test-token');

      const token = authSDK.getAccessToken();

      expect(storage.get).toHaveBeenCalledWith(STORAGE_KEYS.ACCESS_TOKEN);
      expect(token).toBe('test-token');
    });
  });

  describe('logout', () => {
    it('should remove all auth data from storage', () => {
      authSDK.logout();

      expect(storage.remove).toHaveBeenCalledWith(STORAGE_KEYS.ACCESS_TOKEN);
      expect(storage.remove).toHaveBeenCalledWith(STORAGE_KEYS.REFRESH_TOKEN);
      expect(storage.remove).toHaveBeenCalledWith(STORAGE_KEYS.USER);
    });
  });

  describe('isAuthenticated', () => {
    it('should return true if user is stored', () => {
      (storage.getJSON as jest.Mock).mockReturnValue({ id: '1' });

      expect(authSDK.isAuthenticated()).toBe(true);
    });

    it('should return false if no user is stored', () => {
      (storage.getJSON as jest.Mock).mockReturnValue(null);

      expect(authSDK.isAuthenticated()).toBe(false);
    });
  });

  describe('loginWithPi', () => {
    it('should throw error if not in Pi Browser', async () => {
      (isPiBrowser as jest.Mock).mockReturnValue(false);

      await expect(authSDK.loginWithPi()).rejects.toThrow('يجب فتح التطبيق داخل Pi Browser');
    });
  });

  describe('incomplete payment recovery', () => {
    const mockLoginResponse = {
      tokens: { accessToken: 'access-tok', refreshToken: 'refresh-tok' },
      user: { id: '1', piId: 'pi-uid', piUsername: 'tester', role: 'user', subscriptionPlan: null, createdAt: '' },
    };

    beforeEach(() => {
      (isPiBrowser as jest.Mock).mockReturnValue(true);
    });

    it('calls resolve-incomplete when Pi reports an incomplete payment', async () => {
      (window as any).Pi = {
        authenticate: jest.fn().mockImplementation(
          (_scopes: string[], onIncomplete: (p: unknown) => void) => {
            onIncomplete({ identifier: 'pi_pay_123' });
            return Promise.resolve({ accessToken: 'tok', user: { username: 'u', uid: 'uid1' } });
          }
        ),
      };

      mockClient.post
        .mockResolvedValueOnce(undefined)     // resolve-incomplete
        .mockResolvedValueOnce(mockLoginResponse); // pi-login

      await authSDK.loginWithPi();
      await new Promise(r => setTimeout(r, 0)); // flush fire-and-forget

      const calls = (mockClient.post as jest.Mock).mock.calls;
      const recoveryCall = calls.find((c: unknown[]) => c[0] === '/api/payments/cancel');
      expect(recoveryCall).toBeDefined();
      expect(recoveryCall![1]).toEqual({ pi_payment_id: 'pi_pay_123' });
    });

    it('swallows resolve-incomplete errors silently', async () => {
      (window as any).Pi = {
        authenticate: jest.fn().mockImplementation(
          (_scopes: string[], onIncomplete: (p: unknown) => void) => {
            onIncomplete({ identifier: 'pi_pay_err' });
            return Promise.resolve({ accessToken: 'tok', user: { username: 'u', uid: 'uid1' } });
          }
        ),
      };

      mockClient.post
        .mockRejectedValueOnce(new Error('Network error')) // resolve-incomplete fails
        .mockResolvedValueOnce(mockLoginResponse);          // pi-login still succeeds

      await expect(authSDK.loginWithPi()).resolves.toBeDefined();
      await new Promise(r => setTimeout(r, 0));
    });

    it('skips recovery when payment has no identifier', async () => {
      (window as any).Pi = {
        authenticate: jest.fn().mockImplementation(
          (_scopes: string[], onIncomplete: (p: unknown) => void) => {
            onIncomplete({}); // no identifier
            return Promise.resolve({ accessToken: 'tok', user: { username: 'u', uid: 'uid1' } });
          }
        ),
      };

      mockClient.post.mockResolvedValueOnce(mockLoginResponse);

      await authSDK.loginWithPi();
      await new Promise(r => setTimeout(r, 0));

      expect(mockClient.post).toHaveBeenCalledTimes(1);
      expect((mockClient.post as jest.Mock).mock.calls[0][0]).toBe('/api/auth/pi-login');
    });
  });

  describe('getMe', () => {
    it('should fetch current user from API', async () => {
      const mockUser = { id: '1', piUsername: 'testuser' };
      mockClient.get.mockResolvedValue(mockUser);

      const user = await authSDK.getMe();

      expect(mockClient.get).toHaveBeenCalledWith('/api/auth/me');
      expect(user).toEqual(mockUser);
    });
  });
});
