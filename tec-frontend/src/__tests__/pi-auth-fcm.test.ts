/**
 * pi-auth: loginWithPi → _registerFCMToken paths (lines 365-373)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetFCMToken = vi.hoisted(() => vi.fn());

vi.mock('@/lib/sdk', () => ({
  default: {
    clearAuthToken: vi.fn(),
    payment: { resolveIncomplete: vi.fn() },
  },
}));

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  addBreadcrumb:  vi.fn(),
}));

vi.mock('@/lib/firebase', () => ({
  getFCMToken: mockGetFCMToken,
}));

import { loginWithPi } from '@/lib-client/pi/pi-auth';

const loginResponse = {
  success:   true,
  isNewUser: false,
  user: {
    id: 'u-1', piId: 'pi-1', piUsername: 'alice',
    role: 'user', subscriptionPlan: 'Free', createdAt: '2024-01-01',
  },
};

const setupPiAuthSuccess = () => {
  (window as any).Pi = {
    authenticate: vi.fn().mockResolvedValue({
      accessToken: 'pi-token-1',
      user: { uid: 'pi-1', username: 'alice' },
    }),
  };
  (window as any).__TEC_PI_READY = true;
  delete (window as any).__TEC_PI_ERROR;
};

beforeEach(() => {
  vi.clearAllMocks();
  setupPiAuthSuccess();
  global.fetch = vi.fn().mockResolvedValue({
    ok:     true,
    status: 200,
    json:   async () => loginResponse,
  } as Response);
});

describe('loginWithPi FCM token registration', () => {
  it('posts the FCM token to device-tokens endpoint when available', async () => {
    mockGetFCMToken.mockResolvedValue('fcm-tok-123');
    await loginWithPi();
    // FCM registration is fire-and-forget — flush microtasks
    await new Promise(r => setTimeout(r, 10));
    const fcmCall = (global.fetch as any).mock.calls.find(
      (c: any[]) => String(c[0]).includes('/api/notifications/device-tokens'),
    );
    expect(fcmCall).toBeTruthy();
    expect(JSON.parse(fcmCall[1].body)).toEqual({ token: 'fcm-tok-123', platform: 'web' });
  });

  it('skips registration when getFCMToken returns null', async () => {
    mockGetFCMToken.mockResolvedValue(null);
    await loginWithPi();
    await new Promise(r => setTimeout(r, 10));
    const fcmCall = (global.fetch as any).mock.calls.find(
      (c: any[]) => String(c[0]).includes('/api/notifications/device-tokens'),
    );
    expect(fcmCall).toBeUndefined();
  });

  it('login succeeds even when FCM registration throws', async () => {
    mockGetFCMToken.mockRejectedValue(new Error('no permission'));
    const result = await loginWithPi();
    await new Promise(r => setTimeout(r, 10));
    expect(result.success).toBe(true);
    expect(result.user.piUsername).toBe('alice');
  });

  it('login succeeds when device-tokens endpoint fails', async () => {
    mockGetFCMToken.mockResolvedValue('fcm-tok-456');
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (String(url).includes('device-tokens')) throw new Error('network');
      return { ok: true, status: 200, json: async () => loginResponse } as Response;
    });
    const result = await loginWithPi();
    await new Promise(r => setTimeout(r, 10));
    expect(result.success).toBe(true);
  });
});
