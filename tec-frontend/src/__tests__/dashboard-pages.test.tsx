/**
 * Smoke tests for Dashboard pages.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/lib-client/pi/pi-auth', () => ({
  getAccessToken: vi.fn(() => 'tok'),
  getStoredUser:  vi.fn(() => ({ id: 'u1', piUsername: 'alice', subscriptionPlan: 'Free' })),
  loginWithPi:    vi.fn(),
  logout:         vi.fn(),
  isPiBrowser:    vi.fn(() => false),
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

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: {
      common:    { loading: 'Loading...', login: 'Login', appName: 'TEC' },
      dashboard: { title: 'Dashboard', domains: 'Domains', activity: 'Activity' },
      apps:      {},
    },
    locale:      'en',
    setLanguage: vi.fn(),
    dir:         'ltr',
  }),
  LocaleProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib-client/hooks/useWallet', () => ({
  useWallet: () => ({
    wallet:        { balance: 5.00, currency: 'PI', address: null, walletId: 'w1' },
    transactions:  [],
    isLoading:     false,
    isRefreshing:  false,
    error:         null,
    page:          1,
    filterType:    'all',
    filterStatus:  'all',
    setFilterType:   vi.fn(),
    setFilterStatus: vi.fn(),
    loadMore:      vi.fn(),
    refetch:       vi.fn(),
  }),
}));

vi.mock('@/lib-client/hooks/useWalletRealtime', () => ({
  useWalletRealtime: () => ({ event: null }),
}));

vi.mock('@/lib-client/hooks/useOrders', () => ({
  useOrders: () => ({
    orders:          [],
    total:           0,
    totalPages:      1,
    page:            1,
    isLoading:       false,
    isRefreshing:    false,
    error:           null,
    filterStatus:    'all',
    setFilterStatus: vi.fn(),
    refetch:         vi.fn(),
    setPage:         vi.fn(),
  }),
}));

vi.mock('@/lib/request-id', () => ({
  buildHeaders: () => ({ 'Content-Type': 'application/json', 'x-request-id': 'test-id' }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true, json: async () => ({}),
  }) as any;
});

// ── Dashboard main page ──────────────────────────────────────
describe('Dashboard main page', () => {
  it('renders without crash', async () => {
    const { default: Page } = await import('@/app/dashboard/page');
    const { container } = render(<Page />);
    expect(container).toBeTruthy();
  });
});

// ── Dashboard Wallet page ────────────────────────────────────
describe('Dashboard Wallet page', () => {
  it('renders without crash', async () => {
    const { default: Page } = await import('@/app/dashboard/wallet/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });
});

// ── Dashboard Orders page ────────────────────────────────────
describe('Dashboard Orders page', () => {
  it('renders without crash', async () => {
    const { default: Page } = await import('@/app/dashboard/orders/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });
});

// ── Dashboard KYC page ──────────────────────────────────────
describe('Dashboard KYC page', () => {
  it('renders without crash', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ status: 'NOT_STARTED' }),
    }) as any;
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });
});

// ── Dashboard Subscription page ──────────────────────────────
describe('Dashboard Subscription page', () => {
  it('renders without crash', async () => {
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });
});

// ── Dashboard Security page ──────────────────────────────────
describe('Dashboard Security page', () => {
  it('renders without crash', async () => {
    const { default: Page } = await import('@/app/dashboard/security/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });
});
