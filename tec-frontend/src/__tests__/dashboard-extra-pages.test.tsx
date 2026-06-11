/**
 * Smoke tests for additional dashboard pages and components.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter:       () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn(() => null) }),
}));

vi.mock('@/lib-client/hooks/usePiAuth', () => ({
  usePiAuth: () => ({
    user:            { id: 'u1', piUsername: 'alice', role: 'user', subscriptionPlan: 'Free' },
    isAuthenticated: true,
    isLoading:       false,
    login:           vi.fn(),
    logout:          vi.fn(),
    error:           null,
  }),
}));

vi.mock('@/lib-client/pi/pi-auth', () => ({
  getAccessToken: vi.fn(() => 'tok'),
  getStoredUser:  vi.fn(() => ({ id: 'u1', piUsername: 'alice', subscriptionPlan: 'Free' })),
  loginWithPi:    vi.fn(),
  logout:         vi.fn(),
  isPiBrowser:    vi.fn(() => false),
}));

vi.mock('@/lib-client/hooks/useNotifications', () => ({
  useNotifications: () => ({
    notifications:  [],
    unreadCount:    0,
    isLoading:      false,
    isRefreshing:   false,
    error:          null,
    refetch:        vi.fn(),
    markAsRead:     vi.fn(),
    markAllAsRead:  vi.fn(),
  }),
}));

vi.mock('@/lib-client/hooks/usePiSdkReady', () => ({
  usePiSdkReady: () => ({ piReady: false, authReady: false, lastError: null, ensurePiAuth: vi.fn() }),
}));

vi.mock('@/lib-client/pi/marketplace-payment', () => ({
  buyAsset: vi.fn(),
}));

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: { common: { loading: 'Loading...' }, dashboard: { title: 'Dashboard' }, apps: {} },
    locale: 'en',
    setLanguage: vi.fn(),
    dir: 'ltr',
  }),
  LocaleProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/request-id', () => ({
  buildHeaders: () => ({ 'Content-Type': 'application/json', 'x-request-id': 'test-id' }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true, json: async () => ({ metrics: [], events: [] }),
  }) as any;
});

// ── DashboardCard component ────────────────────────────────────────
describe('DashboardCard', () => {
  it('renders children', async () => {
    const { DashboardCard } = await import('@/components/dashboard/DashboardCard');
    const { container } = render(
      <DashboardCard title="Test Card"><div>content</div></DashboardCard>
    );
    expect(container).toBeTruthy();
  });

  it('renders without title', async () => {
    const { DashboardCard } = await import('@/components/dashboard/DashboardCard');
    const { container } = render(<DashboardCard><div>no title</div></DashboardCard>);
    expect(container).toBeTruthy();
  });
});

// ── DashboardShell component ───────────────────────────────────────
describe('DashboardShell', () => {
  it('renders without crash', async () => {
    const { DashboardShell } = await import('@/components/dashboard/DashboardShell');
    const { container } = render(
      <DashboardShell>
        <div>shell content</div>
      </DashboardShell>
    );
    expect(container).toBeTruthy();
  });
});

// ── Dashboard Observability page ────────────────────────────────────
describe('Dashboard Observability page', () => {
  it('renders without crash', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({
        total: 10, completed: 8, failed: 2,
        volume: 50.5, successRate: 80, healthy: true,
      }),
    }) as any;
    const { default: Page } = await import('@/app/dashboard/observability/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });
});

// ── Dashboard Marketplace page ──────────────────────────────────────
describe('Dashboard Marketplace page', () => {
  it('renders without crash', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ assets: [], total: 0 }),
    }) as any;
    const { default: Page } = await import('@/app/dashboard/marketplace/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });
});

// ── Dashboard Notifications page ────────────────────────────────────
describe('Dashboard Notifications page', () => {
  it('renders without crash', async () => {
    const { default: Page } = await import('@/app/dashboard/notifications/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });
});

// ── Dashboard Profile page ───────────────────────────────────────────
describe('Dashboard Profile page', () => {
  it('renders without crash', async () => {
    const { default: Page } = await import('@/app/dashboard/profile/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });
});

// ── Dashboard Analytics page ─────────────────────────────────────────
describe('Dashboard Analytics page', () => {
  it('renders without crash', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ stats: {}, events: [] }),
    }) as any;
    const { default: Page } = await import('@/app/dashboard/analytics/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });
});

// ── Dashboard Checkout page ──────────────────────────────────────────
describe('Dashboard Checkout page', () => {
  it('renders without crash', async () => {
    const { default: Page } = await import('@/app/dashboard/orders/checkout/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });
});

// ── Dashboard Assets page ────────────────────────────────────────────
describe('Dashboard Assets page', () => {
  it('renders without crash', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ assets: [] }),
    }) as any;
    const { default: Page } = await import('@/app/dashboard/assets/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });
});
