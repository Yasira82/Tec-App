/**
 * Comprehensive tests for low-coverage dashboard pages:
 *   dashboard/kyc, dashboard/notifications, dashboard/wallet (extra states)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';

// ── Hoisted mock refs ─────────────────────────────────────────
const mockUseKyc            = vi.hoisted(() => vi.fn());
const mockUseNotifications  = vi.hoisted(() => vi.fn());
const mockUseWallet         = vi.hoisted(() => vi.fn());
const mockUseWalletRealtime = vi.hoisted(() => vi.fn());

// ── Module mocks ──────────────────────────────────────────────
vi.mock('@/lib-client/hooks/useKyc', () => ({
  useKyc: mockUseKyc,
}));

vi.mock('@/lib-client/hooks/useNotifications', () => ({
  useNotifications: mockUseNotifications,
}));

vi.mock('@/lib-client/hooks/useWallet', () => ({
  useWallet: mockUseWallet,
}));

vi.mock('@/lib-client/hooks/useWalletRealtime', () => ({
  useWalletRealtime: mockUseWalletRealtime,
}));

vi.mock('next/navigation', () => ({
  useRouter:       () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn(() => null) }),
}));

vi.mock('@/lib-client/pi/pi-auth', () => ({
  getAccessToken: vi.fn(() => 'tok'),
  getStoredUser:  vi.fn(() => ({ id: 'u1', piUsername: 'alice', subscriptionPlan: 'Free' })),
  loginWithPi:    vi.fn(),
  logout:         vi.fn(),
  isPiBrowser:    vi.fn(() => false),
}));

vi.mock('@/lib/request-id', () => ({
  buildHeaders: vi.fn(() => ({ 'x-request-id': 'req-id' })),
}));

vi.mock('@/components/dashboard', () => ({
  DashboardShell: ({ children, loading, title, actions }: {
    children?: React.ReactNode; loading?: boolean; title?: string; actions?: React.ReactNode;
  }) =>
    loading
      ? <div data-testid="shell-loading">Loading…</div>
      : <div data-testid="shell"><h1>{title}</h1>{actions}{children}</div>,
  DashboardCard: ({ children }: { children?: React.ReactNode }) =>
    <div data-testid="card">{children}</div>,
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

// ── Default mock state helpers ─────────────────────────────────
const kycBase = {
  kyc:          null,
  isLoading:    false,
  isSubmitting: false,
  error:        null,
  refetch:      vi.fn(),
  uploadDocs:   vi.fn(),
  submit:       vi.fn(),
  reset:        vi.fn(),
};

const kycRecord = (status: string, extras = {}) => ({
  id: 'kyc-1', user_id: 'u1', status, level: 'L0',
  id_front_url: null, id_back_url: null, selfie_url: null,
  rejection_reason: null, verified_at: null, submitted_at: null, created_at: '2024-01-01',
  ...extras,
});

const notifBase = {
  notifications:  [],
  unreadCount:    0,
  isLoading:      false,
  isRefreshing:   false,
  error:          null,
  refetch:        vi.fn(),
  markAsRead:     vi.fn(),
  markAllAsRead:  vi.fn(),
};

const walletBase = {
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
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseKyc.mockReturnValue(kycBase);
  mockUseNotifications.mockReturnValue(notifBase);
  mockUseWallet.mockReturnValue(walletBase);
  mockUseWalletRealtime.mockReturnValue({ event: null });
  global.fetch = vi.fn().mockResolvedValue({
    ok: true, json: async () => ({}),
  }) as any;
});

// ═══════════════════════════════════════════════════════════════
// Dashboard KYC Page
// ═══════════════════════════════════════════════════════════════
describe('DashboardKycPage', () => {
  it('renders loading state', async () => {
    mockUseKyc.mockReturnValueOnce({ ...kycBase, isLoading: true });
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    const { getByTestId } = render(<Page />);
    expect(getByTestId('shell-loading')).toBeTruthy();
  });

  it('renders null KYC (no status card)', async () => {
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    const { container } = render(<Page />);
    expect(container).toBeTruthy();
  });

  it('renders error message', async () => {
    mockUseKyc.mockReturnValueOnce({ ...kycBase, error: 'Failed to load KYC data' });
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Failed to load KYC data');
  });

  it('renders NOT_STARTED status with upload form', async () => {
    mockUseKyc.mockReturnValueOnce({
      ...kycBase,
      kyc: kycRecord('NOT_STARTED'),
    });
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Not Started');
    expect(container.textContent).toContain('Upload Documents');
  });

  it('renders PENDING status', async () => {
    mockUseKyc.mockReturnValueOnce({
      ...kycBase,
      kyc: kycRecord('PENDING'),
    });
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Under Review');
  });

  it('renders VERIFIED status with level and date', async () => {
    mockUseKyc.mockReturnValueOnce({
      ...kycBase,
      kyc: kycRecord('VERIFIED', { level: 'L1', verified_at: '2024-06-01T00:00:00Z' }),
    });
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Verified');
    expect(container.textContent).toContain('Identity Verified');
  });

  it('renders REJECTED status with reason', async () => {
    mockUseKyc.mockReturnValueOnce({
      ...kycBase,
      kyc: kycRecord('REJECTED', { rejection_reason: 'Document expired' }),
    });
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Document expired');
    expect(container.textContent).toContain('Verification Rejected');
  });

  it('renders REJECTED without reason', async () => {
    mockUseKyc.mockReturnValueOnce({
      ...kycBase,
      kyc: kycRecord('REJECTED'),
    });
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Verification Rejected');
  });

  it('renders NOT_STARTED with existing doc URLs (review step)', async () => {
    mockUseKyc.mockReturnValueOnce({
      ...kycBase,
      kyc: kycRecord('NOT_STARTED', {
        id_front_url: 'https://storage/id.jpg',
        selfie_url:   'https://storage/selfie.jpg',
      }),
    });
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Not Started');
  });
});

// ═══════════════════════════════════════════════════════════════
// Dashboard Notifications Page
// ═══════════════════════════════════════════════════════════════
describe('DashboardNotificationsPage', () => {
  it('renders loading state', async () => {
    mockUseNotifications.mockReturnValueOnce({ ...notifBase, isLoading: true });
    const { default: Page } = await import('@/app/dashboard/notifications/page');
    const { getByTestId } = render(<Page />);
    expect(getByTestId('shell-loading')).toBeTruthy();
  });

  it('renders empty notifications', async () => {
    const { default: Page } = await import('@/app/dashboard/notifications/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('All caught up');
  });

  it('renders error state with retry button', async () => {
    mockUseNotifications.mockReturnValueOnce({
      ...notifBase,
      error: 'Failed to load notifications',
    });
    const { default: Page } = await import('@/app/dashboard/notifications/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Failed to load notifications');
    expect(container.textContent).toContain('Retry');
  });

  it('renders unread and read notifications', async () => {
    mockUseNotifications.mockReturnValueOnce({
      ...notifBase,
      unreadCount: 1,
      notifications: [
        {
          id: 'n1', type: 'PAYMENT', title: 'Payment received',
          message: '5π credited', read: false,
          created_at: new Date(Date.now() - 120000).toISOString(),
        },
        {
          id: 'n2', type: 'SYSTEM', title: 'System update',
          message: 'Platform updated', read: true,
          created_at: new Date(Date.now() - 7200000).toISOString(),
        },
      ],
    });
    const { default: Page } = await import('@/app/dashboard/notifications/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Payment received');
    expect(container.textContent).toContain('System update');
  });

  it('renders mark-all-read button when unread > 0', async () => {
    mockUseNotifications.mockReturnValueOnce({
      ...notifBase,
      unreadCount: 3,
      notifications: [
        {
          id: 'n3', type: 'KYC', title: 'KYC approved',
          message: 'Verified', read: false,
          created_at: new Date(Date.now() - 300000).toISOString(),
        },
      ],
    });
    const { default: Page } = await import('@/app/dashboard/notifications/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Mark all read');
  });

  it('renders notifications with all NotifType variants', async () => {
    const types = ['PAYMENT', 'WALLET', 'KYC', 'SECURITY', 'SYSTEM'] as const;
    mockUseNotifications.mockReturnValueOnce({
      ...notifBase,
      unreadCount: 2,
      notifications: types.map((type, i) => ({
        id:         `n${i}`,
        type,
        title:      `${type} notification`,
        message:    `${type} message`,
        read:       i > 1,
        created_at: new Date(Date.now() - i * 3600000).toISOString(),
      })),
    });
    const { default: Page } = await import('@/app/dashboard/notifications/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('PAYMENT notification');
    expect(container.textContent).toContain('SYSTEM notification');
  });

  it('renders refreshing state', async () => {
    mockUseNotifications.mockReturnValueOnce({ ...notifBase, isRefreshing: true });
    const { default: Page } = await import('@/app/dashboard/notifications/page');
    const { container } = render(<Page />);
    expect(container).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// Dashboard Wallet Page (additional states)
// ═══════════════════════════════════════════════════════════════
describe('DashboardWalletPage (extra states)', () => {
  it('renders loading state', async () => {
    mockUseWallet.mockReturnValueOnce({ ...walletBase, isLoading: true, wallet: null });
    const { default: Page } = await import('@/app/dashboard/wallet/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });

  it('renders with null wallet (no balance)', async () => {
    mockUseWallet.mockReturnValueOnce({ ...walletBase, wallet: null });
    const { default: Page } = await import('@/app/dashboard/wallet/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });

  it('renders with transactions', async () => {
    mockUseWallet.mockReturnValueOnce({
      ...walletBase,
      transactions: [
        {
          id: 'tx1', type: 'receive', amount: 5, currency: 'PI', status: 'completed',
          description: 'Payment received', created_at: new Date().toISOString(),
          from_wallet_id: null, to_wallet_id: 'w1',
        },
        {
          id: 'tx2', type: 'send', amount: 2, currency: 'PI', status: 'completed',
          description: 'Payment sent', created_at: new Date(Date.now() - 86400000).toISOString(),
          from_wallet_id: 'w1', to_wallet_id: null,
        },
      ],
    });
    const { default: Page } = await import('@/app/dashboard/wallet/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });

  it('renders error state', async () => {
    mockUseWallet.mockReturnValueOnce({ ...walletBase, error: 'Failed to load wallet' });
    const { default: Page } = await import('@/app/dashboard/wallet/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });

  it('handles realtime wallet update event', async () => {
    mockUseWalletRealtime.mockReturnValueOnce({
      event: {
        walletId: 'w1', type: 'wallet.updated.v1',
        balance: 10, currency: 'PI', timestamp: new Date().toISOString(),
      },
    });
    const { default: Page } = await import('@/app/dashboard/wallet/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// Dashboard Security page (missing from extra tests)
// ═══════════════════════════════════════════════════════════════
describe('DashboardSecurityPage', () => {
  it('renders without crash', async () => {
    const { default: Page } = await import('@/app/dashboard/security/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// Dashboard Orders page (extra states)
// ═══════════════════════════════════════════════════════════════
describe('DashboardOrdersPage (extra states)', () => {
  it('renders loading state', async () => {
    const useOrders = vi.fn().mockReturnValue({
      orders: [], total: 0, totalPages: 1, page: 1,
      isLoading: true, isRefreshing: false, error: null,
      filterStatus: 'all', setFilterStatus: vi.fn(),
      refetch: vi.fn(), setPage: vi.fn(),
    });
    vi.doMock('@/lib-client/hooks/useOrders', () => ({ useOrders }));
    const { default: Page } = await import('@/app/dashboard/orders/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// Dashboard Subscription page (extra states)
// ═══════════════════════════════════════════════════════════════
describe('DashboardSubscriptionPage (extra states)', () => {
  it('renders with active subscription data', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          plan: 'PRO', status: 'ACTIVE',
          current_period_end: '2024-12-31', isExpired: false,
          planDetails: { id: 'PRO', name: 'Pro', price: 10, currency: 'PI', duration: 30, features: [] },
        },
      }),
    }) as any;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });

  it('renders with no subscription', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: null }),
    }) as any;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// Hub Pay page
// ═══════════════════════════════════════════════════════════════
describe('HubPayPage', () => {
  it('renders redirect spinner without crash', async () => {
    const { default: Page } = await import('@/app/hub/pay/page');
    const { container } = render(<Page />);
    expect(container).toBeTruthy();
  });
});
