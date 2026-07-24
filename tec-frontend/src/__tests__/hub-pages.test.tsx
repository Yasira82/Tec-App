/**
 * Smoke tests for Hub sub-pages:
 *   /hub/kyc, /hub/subscription, /hub/notifications, /hub/profile
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// ── Shared component mocks ────────────────────────────────────────
vi.mock('@/components/hub', () => ({
  HubSubShell: ({ children, title, loading }: { children?: React.ReactNode; title?: string; loading?: boolean }) =>
    loading
      ? <div data-testid="loading">Loading…</div>
      : <div data-testid="hub-shell"><h1>{title}</h1>{children}</div>,
}));

vi.mock('@/components/dashboard', () => ({
  DashboardCard: ({ children, title, subtitle }: {
    children?: React.ReactNode; title?: string; subtitle?: string;
  }) => <div data-testid="dashboard-card"><h2>{title}</h2><p>{subtitle}</p>{children}</div>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));

// ── Auth / pi-auth mocks ──────────────────────────────────────────
const mockUsePiAuthFn2 = vi.hoisted(() => vi.fn());

vi.mock('@/lib-client/hooks/usePiAuth', () => ({
  usePiAuth: mockUsePiAuthFn2,
}));

vi.mock('@/lib-client/pi/pi-auth', () => ({
  getAccessToken: vi.fn(() => 'test-tok'),
  getStoredUser:  vi.fn(() => ({ id: 'u1', piUsername: 'alice' })),
}));

// ── Hook mocks ────────────────────────────────────────────────────
vi.mock('@/lib-client/hooks/useKyc', () => ({
  useKyc: vi.fn(),
}));

vi.mock('@/lib-client/hooks/useNotifications', () => ({
  useNotifications: vi.fn(),
}));

// Default auth state
const defaultUser = {
  user:            { id: 'u1', piUsername: 'alice', role: 'user', subscriptionPlan: 'Free' },
  isAuthenticated: true,
  isLoading:       false,
  login:           vi.fn(),
  logout:          vi.fn(),
  error:           null,
  errorType:       null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUsePiAuthFn2.mockReturnValue(defaultUser);
  global.fetch = vi.fn().mockResolvedValue({
    ok: true, json: async () => ({ data: null }),
  }) as any;
});

// ═══════════════════════════════════════════════════════════════
// KYC Page
// ═══════════════════════════════════════════════════════════════
describe('HubKycPage', () => {
  it('renders loading state', async () => {
    const { useKyc } = await import('@/lib-client/hooks/useKyc');
    vi.mocked(useKyc).mockReturnValue({
      kyc: null, isLoading: true, isSubmitting: false, error: null,
      refetch: vi.fn(), uploadDocs: vi.fn(), submit: vi.fn(), reset: vi.fn(),
    } as any);
    const { default: HubKycPage } = await import('@/app/hub/kyc/page');
    const { getByTestId } = render(<HubKycPage />);
    expect(getByTestId('loading')).toBeTruthy();
  });

  it('renders with null kyc (initial state)', async () => {
    const { useKyc } = await import('@/lib-client/hooks/useKyc');
    vi.mocked(useKyc).mockReturnValue({
      kyc: null, isLoading: false, isSubmitting: false, error: null,
      refetch: vi.fn(), uploadDocs: vi.fn(), submit: vi.fn(), reset: vi.fn(),
    } as any);
    const { default: HubKycPage } = await import('@/app/hub/kyc/page');
    const { container } = render(<HubKycPage />);
    expect(container).toBeTruthy();
  });

  it('renders KYC form for NOT_STARTED status', async () => {
    const { useKyc } = await import('@/lib-client/hooks/useKyc');
    vi.mocked(useKyc).mockReturnValue({
      kyc: {
        id: 'k1', user_id: 'u1', status: 'NOT_STARTED', level: 'L0',
        id_front_url: null, id_back_url: null, selfie_url: null,
        rejection_reason: null, verified_at: null, submitted_at: null, created_at: '2024-01-01',
      },
      isLoading: false, isSubmitting: false, error: null,
      refetch: vi.fn(), uploadDocs: vi.fn(), submit: vi.fn(), reset: vi.fn(),
    } as any);
    const { default: HubKycPage } = await import('@/app/hub/kyc/page');
    const { container } = render(<HubKycPage />);
    expect(container.textContent).toContain('Upload Documents');
  });

  it('renders pending state', async () => {
    const { useKyc } = await import('@/lib-client/hooks/useKyc');
    vi.mocked(useKyc).mockReturnValue({
      kyc: {
        id: 'k1', user_id: 'u1', status: 'PENDING', level: 'L0',
        id_front_url: null, id_back_url: null, selfie_url: null,
        rejection_reason: null, verified_at: null, submitted_at: null, created_at: '2024-01-01',
      },
      isLoading: false, isSubmitting: false, error: null,
      refetch: vi.fn(), uploadDocs: vi.fn(), submit: vi.fn(), reset: vi.fn(),
    } as any);
    const { default: HubKycPage } = await import('@/app/hub/kyc/page');
    const { container } = render(<HubKycPage />);
    expect(container.textContent).toContain('Under Review');
  });

  it('renders verified state', async () => {
    const { useKyc } = await import('@/lib-client/hooks/useKyc');
    vi.mocked(useKyc).mockReturnValue({
      kyc: {
        id: 'k1', user_id: 'u1', status: 'VERIFIED', level: 'L1',
        id_front_url: null, id_back_url: null, selfie_url: null,
        rejection_reason: null, verified_at: '2024-06-01', submitted_at: null, created_at: '2024-01-01',
      },
      isLoading: false, isSubmitting: false, error: null,
      refetch: vi.fn(), uploadDocs: vi.fn(), submit: vi.fn(), reset: vi.fn(),
    } as any);
    const { default: HubKycPage } = await import('@/app/hub/kyc/page');
    const { container } = render(<HubKycPage />);
    expect(container.textContent).toContain('Identity Verified');
  });

  it('renders rejected state with reason', async () => {
    const { useKyc } = await import('@/lib-client/hooks/useKyc');
    vi.mocked(useKyc).mockReturnValue({
      kyc: {
        id: 'k1', user_id: 'u1', status: 'REJECTED', level: 'L0',
        id_front_url: null, id_back_url: null, selfie_url: null,
        rejection_reason: 'Blurry image', verified_at: null, submitted_at: null, created_at: '2024-01-01',
      },
      isLoading: false, isSubmitting: false, error: null,
      refetch: vi.fn(), uploadDocs: vi.fn(), submit: vi.fn(), reset: vi.fn(),
    } as any);
    const { default: HubKycPage } = await import('@/app/hub/kyc/page');
    const { container } = render(<HubKycPage />);
    expect(container.textContent).toContain('Blurry image');
  });

  it('renders error message', async () => {
    const { useKyc } = await import('@/lib-client/hooks/useKyc');
    vi.mocked(useKyc).mockReturnValue({
      kyc: null, isLoading: false, isSubmitting: false, error: 'Failed to load KYC data',
      refetch: vi.fn(), uploadDocs: vi.fn(), submit: vi.fn(), reset: vi.fn(),
    } as any);
    const { default: HubKycPage } = await import('@/app/hub/kyc/page');
    const { container } = render(<HubKycPage />);
    expect(container.textContent).toContain('Failed to load KYC data');
  });
});

// ═══════════════════════════════════════════════════════════════
// Subscription Page
// ═══════════════════════════════════════════════════════════════
describe('HubSubscriptionPage', () => {
  it('renders in loading state', async () => {
    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {})) as any;
    const { default: HubSubscriptionPage } = await import('@/app/hub/subscription/page');
    const { getByTestId } = render(<HubSubscriptionPage />);
    expect(getByTestId('loading')).toBeTruthy();
  });

  it('renders with plans shown (no active sub)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: null }),
    }) as any;
    const { default: HubSubscriptionPage } = await import('@/app/hub/subscription/page');
    const { container } = render(<HubSubscriptionPage />);
    expect(container).toBeTruthy();
  });

  it('renders with active PRO subscription', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          plan:               'PRO',
          status:             'ACTIVE',
          current_period_end: '2024-12-31',
          isExpired:          false,
          planDetails:        { id: 'PRO', name: 'Pro', price: 10, currency: 'PI', duration: 30, features: ['Unlimited assets'] },
        },
      }),
    }) as any;
    const { default: HubSubscriptionPage } = await import('@/app/hub/subscription/page');
    const { container } = render(<HubSubscriptionPage />);
    expect(container).toBeTruthy();
  });

  it('renders with failed fetch (no subscription)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, json: async () => ({}),
    }) as any;
    const { default: HubSubscriptionPage } = await import('@/app/hub/subscription/page');
    const { container } = render(<HubSubscriptionPage />);
    expect(container).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// Notifications Page
// ═══════════════════════════════════════════════════════════════
describe('HubNotificationsPage', () => {
  it('renders loading state', async () => {
    const { useNotifications } = await import('@/lib-client/hooks/useNotifications');
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [], unreadCount: 0, isLoading: true, error: null,
      markRead: vi.fn(), markAllRead: vi.fn(), refetch: vi.fn(),
    } as any);
    const { default: HubNotificationsPage } = await import('@/app/hub/notifications/page');
    const { getByTestId } = render(<HubNotificationsPage />);
    expect(getByTestId('loading')).toBeTruthy();
  });

  it('renders empty notifications state', async () => {
    const { useNotifications } = await import('@/lib-client/hooks/useNotifications');
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [], unreadCount: 0, isLoading: false, error: null,
      markRead: vi.fn(), markAllRead: vi.fn(), refetch: vi.fn(),
    } as any);
    const { default: HubNotificationsPage } = await import('@/app/hub/notifications/page');
    const { container } = render(<HubNotificationsPage />);
    expect(container.textContent).toContain('All caught up');
  });

  it('renders with unread notifications', async () => {
    const { useNotifications } = await import('@/lib-client/hooks/useNotifications');
    vi.mocked(useNotifications).mockReturnValue({
      unreadCount: 2,
      isLoading: false,
      error: null,
      markRead: vi.fn(),
      markAllRead: vi.fn(),
      refetch: vi.fn(),
      notifications: [
        {
          id: 'n1', type: 'PAYMENT', title: 'Payment received',
          message: 'You received 5π', read: false,
          created_at: new Date().toISOString(),
        },
        {
          id: 'n2', type: 'SYSTEM', title: 'System update',
          message: 'Platform updated', read: true,
          created_at: new Date(Date.now() - 7200000).toISOString(),
        },
      ],
    } as any);
    const { default: HubNotificationsPage } = await import('@/app/hub/notifications/page');
    const { container } = render(<HubNotificationsPage />);
    expect(container.textContent).toContain('Payment received');
    expect(container.textContent).toContain('System update');
  });

  it('renders with KYC and WALLET notification types', async () => {
    const { useNotifications } = await import('@/lib-client/hooks/useNotifications');
    vi.mocked(useNotifications).mockReturnValue({
      unreadCount: 1,
      isLoading: false,
      error: null,
      markRead: vi.fn(),
      markAllRead: vi.fn(),
      refetch: vi.fn(),
      notifications: [
        {
          id: 'n3', type: 'KYC', title: 'KYC approved',
          message: 'Your identity was verified', read: false,
          created_at: new Date(Date.now() - 172800000).toISOString(),
        },
        {
          id: 'n4', type: 'WALLET', title: 'Wallet credited',
          message: '5π added to wallet', read: true,
          created_at: new Date(Date.now() - 604800001).toISOString(),
        },
      ],
    } as any);
    const { default: HubNotificationsPage } = await import('@/app/hub/notifications/page');
    const { container } = render(<HubNotificationsPage />);
    expect(container.textContent).toContain('KYC approved');
    expect(container.textContent).toContain('Wallet credited');
  });

  it('renders error state', async () => {
    const { useNotifications } = await import('@/lib-client/hooks/useNotifications');
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [], unreadCount: 0, isLoading: false, error: 'Failed to load notifications',
      markRead: vi.fn(), markAllRead: vi.fn(), refetch: vi.fn(),
    } as any);
    const { default: HubNotificationsPage } = await import('@/app/hub/notifications/page');
    const { container } = render(<HubNotificationsPage />);
    expect(container.textContent).toContain('Failed to load');
  });
});

// ═══════════════════════════════════════════════════════════════
// Profile Page
// ═══════════════════════════════════════════════════════════════
describe('HubProfilePage', () => {
  it('renders with authenticated user', async () => {
    const { default: HubProfilePage } = await import('@/app/hub/profile/page');
    const { container } = render(<HubProfilePage />);
    expect(container).toBeTruthy();
    expect(container.textContent).toContain('alice');
  });

  it('renders without user (guest state)', async () => {
    mockUsePiAuthFn2.mockReturnValueOnce({
      ...defaultUser, user: null, isAuthenticated: false,
    });
    const { default: HubProfilePage } = await import('@/app/hub/profile/page');
    const { container } = render(<HubProfilePage />);
    expect(container).toBeTruthy();
  });

  it('renders all user info fields', async () => {
    mockUsePiAuthFn2.mockReturnValueOnce({
      ...defaultUser,
      user: { id: 'u-abc-123', piUsername: 'bob', role: 'admin', subscriptionPlan: 'PRO' },
    });
    const { default: HubProfilePage } = await import('@/app/hub/profile/page');
    const { container } = render(<HubProfilePage />);
    expect(container.textContent).toContain('bob');
  });
});
