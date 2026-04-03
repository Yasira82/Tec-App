import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase', () => ({
  getFCMToken: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/sdk', () => ({
  default: {
    auth: {
      loginWithPi:  vi.fn(),
      refreshToken: vi.fn(),
    },
    payment: {
      createPayment:     vi.fn(),
      approvePayment:    vi.fn(),
      completePayment:   vi.fn(),
      getPayment:        vi.fn(),
      resolveIncomplete: vi.fn(),
    },
    setAuthToken:   vi.fn(),
    clearAuthToken: vi.fn(),
  },
}));

import sdk from '@/lib/sdk';
import { loginWithPi } from '@/lib-client/pi/pi-auth';

const MOCK_LOGIN_RESPONSE = {
  success:   true,
  isNewUser: false,
  user: {
    id:               'u1',
    piId:             'pi-uid',
    piUsername:       'tester',
    role:             'user',
    subscriptionPlan: null,
    createdAt:        '2024-01-01',
  },
};

// ✅ Helper — يعمل mock للـ /api/auth/pi-login دايماً
const mockFetch = (overrides: Record<string, Response> = {}) => {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const u = String(url);

    // ✅ pi-login دايماً ينجح
    if (u.includes('/api/auth/pi-login')) {
      return {
        ok:   true,
        status: 200,
        json: async () => MOCK_LOGIN_RESPONSE,
      } as Response;
    }

    // Custom overrides
    for (const [pattern, response] of Object.entries(overrides)) {
      if (u.includes(pattern)) return response;
    }

    return { ok: false, status: 404, json: async () => ({}) } as Response;
  });
};

const setupWindow = (incompletePayment?: unknown) => {
  (window as any).__TEC_PI_READY = true;
  (window as any).__TEC_PI_ERROR = false;
  (window as any).Pi = {
    authenticate: vi.fn().mockImplementation(
      (_scopes: string[], onIncomplete: (p: unknown) => void) => {
        if (incompletePayment) onIncomplete(incompletePayment);
        return Promise.resolve({
          accessToken: 'pi-test-token',
          user:        { username: 'tester', uid: 'pi-uid' },
        });
      }
    ),
    createPayment: vi.fn(),
    init:          vi.fn(),
  };
};

describe('pi-auth: incomplete payment recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stops at Step 1 when backend resolves payment (200)', async () => {
    setupWindow({ identifier: 'pi_pay_123' });

    const fetchSpy = mockFetch({
      '/api/payment/resolve-incomplete': {
        ok: true, status: 200, json: async () => ({ action: 'resolved' }),
      } as Response,
    });

    await loginWithPi();
    await new Promise(r => setTimeout(r, 10));

    const step1 = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes('/api/payment/resolve-incomplete')
    );
    expect(step1).toHaveLength(1);
    expect(JSON.parse((step1[0][1] as RequestInit).body as string)).toEqual({
      pi_payment_id: 'pi_pay_123',
    });
    expect(sdk.payment.resolveIncomplete).not.toHaveBeenCalled();
  });

  it('falls to Step 2 (SDK) when backend returns non-ok', async () => {
    setupWindow({ identifier: 'pi_pay_456' });

    mockFetch({
      '/api/payment/resolve-incomplete': {
        ok: false, status: 500, json: async () => ({ error: 'Server error' }),
      } as Response,
    });
    vi.mocked(sdk.payment.resolveIncomplete).mockResolvedValue(undefined as any);

    await loginWithPi();
    await new Promise(r => setTimeout(r, 10));

    expect(sdk.payment.resolveIncomplete).toHaveBeenCalledWith('pi_pay_456');
  });

  it('falls to Step 3 (cancel) when Steps 1 and 2 both fail', async () => {
    setupWindow({ identifier: 'pi_pay_789' });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/api/auth/pi-login'))
        return { ok: true, status: 200, json: async () => MOCK_LOGIN_RESPONSE } as Response;
      if (u.includes('/api/payment/resolve-incomplete'))
        throw new Error('Network error');
      if (u.includes('/api/payment/cancel'))
        return { ok: true, status: 200, json: async () => ({ action: 'cancelled' }) } as Response;
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });
    vi.mocked(sdk.payment.resolveIncomplete).mockRejectedValue(new Error('SDK error'));

    await loginWithPi();
    await new Promise(r => setTimeout(r, 10));

    const step3 = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes('/api/payment/cancel')
    );
    expect(step3).toHaveLength(1);
    expect(JSON.parse((step3[0][1] as RequestInit).body as string)).toEqual({
      pi_payment_id: 'pi_pay_789',
    });
  });

  it('skips recovery entirely when no incomplete payment', async () => {
    // مفيش incompletePayment — الـ callback مش بيتكال
    setupWindow();

    const fetchSpy = mockFetch();

    await loginWithPi();
    await new Promise(r => setTimeout(r, 10));

    const recoveryCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes('/api/payment/')
    );
    expect(recoveryCalls).toHaveLength(0);
    expect(sdk.payment.resolveIncomplete).not.toHaveBeenCalled();
  });
});
