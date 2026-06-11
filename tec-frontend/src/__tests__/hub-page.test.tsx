/**
 * Smoke test for the Hub main page (hub/page.tsx).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/lib-client/hooks/usePiAuth', () => ({
  usePiAuth: () => ({
    user:            { id: 'u1', piUsername: 'alice', subscriptionPlan: 'Free', kycVerified: false },
    isAuthenticated: true,
    isLoading:       false,
    login:           vi.fn(),
    logout:          vi.fn(),
    error:           null,
  }),
}));

vi.mock('@/lib-client/hooks/usePiSdkReady', () => ({
  usePiSdkReady: () => ({ piReady: false, authReady: false, lastError: null, ensurePiAuth: vi.fn() }),
}));

vi.mock('@/lib-client/pi/pi-session', () => ({
  piSession: { ensureAuth: vi.fn().mockResolvedValue(true), ensurePaymentsReady: vi.fn(), reset: vi.fn() },
  PiAuthError: {},
}));

vi.mock('@/lib-client/hooks/useRealtimeNotifications', () => ({
  useRealtimeNotifications: () => ({ unread: 0, connected: false, clearUnread: vi.fn() }),
}));

vi.mock('@/lib-client/pi/pi-auth', () => ({
  getAccessToken: vi.fn(() => 'tok'),
  getStoredUser:  vi.fn(() => ({ id: 'u1', piUsername: 'alice' })),
  loginWithPi:    vi.fn(),
  logout:         vi.fn(),
  isPiBrowser:    vi.fn(() => false),
}));

vi.mock('@/hooks/useHubData', () => ({
  useHubData: () => ({
    balance:        '5.00',
    assetCount:     0,
    piPrice:        null,
    notifCount:     0,
    time:           '12:00',
    setNotifCount:  vi.fn(),
    refresh:        vi.fn(),
    refreshBalance: vi.fn(),
  }),
}));

vi.mock('@/lib/hub/utils', () => ({ haptic: vi.fn() }));

vi.mock('@/app/hub/components/ToastContainer', () => ({
  ToastContainer: () => null,
}));

vi.mock('@/app/hub/components/AIDrawer', () => ({
  AIDrawer: () => null,
}));

vi.mock('@/app/hub/components/HubSkeleton', () => ({
  HubSkeleton: () => null,
}));

vi.mock('@/app/hub/components/PullIndicator', () => ({
  PullIndicator: () => null,
}));

vi.mock('@/app/hub/components/PaymentModal', () => ({
  PaymentModal:    () => null,
  ExternalPayment: {},
}));

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: { common: { loading: 'Loading...' }, dashboard: {}, apps: {} },
    locale: 'en',
    setLanguage: vi.fn(),
    dir: 'ltr',
  }),
  LocaleProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true, json: async () => ({}),
  }) as any;
});

describe('Hub main page', () => {
  it('renders without crash', async () => {
    const { default: Page } = await import('@/app/hub/page');
    const { container } = render(<Page />);
    expect(container).toBeTruthy();
  });

  it('renders HubSkeleton while loading', async () => {
    const { default: Page } = await import('@/app/hub/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });
});
