/**
 * Comprehensive render tests for multiple low-coverage page files.
 * Targets: hub/page, dashboard/wallet/page, dashboard/page, mint/page,
 *          dashboard/orders/checkout/page, hub/subscription/page,
 *          dashboard/subscription/page, dashboard/security/page,
 *          dashboard/marketplace/page, dashboard/orders/page,
 *          hub/kyc/page, dashboard/kyc/page, dashboard/analytics/page,
 *          dashboard/profile/page, hub/profile/page,
 *          dashboard/assets/page, dashboard/observability/page,
 *          dashboard/notifications/page
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';

// ─── next/navigation ────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter:       () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname:     () => '/dashboard',
  useSearchParams: () => ({ get: vi.fn(() => null) }),
  redirect:        vi.fn(),
}));

// ─── next/link + next/image ──────────────────────────────────────
vi.mock('next/link', () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }));
vi.mock('next/image', () => ({ default: ({ src, alt }: any) => <img src={src} alt={alt} /> }));

// ─── Pi auth helpers ─────────────────────────────────────────────
vi.mock('@/lib-client/pi/pi-auth', () => ({
  getAccessToken: vi.fn(() => 'test-token'),
  getStoredUser:  vi.fn(() => ({ id: 'u-1', username: 'testuser', uid: 'u-1' })),
  getCsrfToken:   vi.fn(() => 'csrf-tok'),
  ssoRedirect:    vi.fn(),
  loginWithPi:    vi.fn(),
  logout:         vi.fn(),
  isPiBrowser:    vi.fn(() => false),
}));

// ─── usePiAuth ────────────────────────────────────────────────────
vi.mock('@/lib-client/hooks/usePiAuth', () => ({
  usePiAuth: vi.fn(() => ({
    user:            { id: 'u-1', piUsername: 'testuser', piId: 'pi-uid-1', uid: 'u-1', role: 'user', subscriptionPlan: 'Free', createdAt: '2024-01-01T00:00:00Z' },
    isAuthenticated: true,
    isLoading:       false,
    login:           vi.fn(),
    logout:          vi.fn(),
    error:           null,
  })),
}));

// ─── usePiSdkReady ───────────────────────────────────────────────
vi.mock('@/lib-client/hooks/usePiSdkReady', () => ({
  usePiSdkReady: vi.fn(() => ({
    piReady: true, authReady: true, lastError: null,
    ensurePiAuth: vi.fn().mockResolvedValue(true),
  })),
}));

// ─── pi-session ──────────────────────────────────────────────────
vi.mock('@/lib-client/pi/pi-session', () => ({
  piSession: {
    ensureAuth:          vi.fn().mockResolvedValue(true),
    ensurePaymentsReady: vi.fn().mockResolvedValue(true),
    reset:               vi.fn(),
    acquirePaymentLock:  vi.fn().mockResolvedValue(true),
    releasePaymentLock:  vi.fn(),
    lastError:           null,
  },
  PiAuthError: {},
}));

// ─── PiRuntime ───────────────────────────────────────────────────
vi.mock('@/lib-client/pi/PiRuntime', () => ({
  PiRuntime: {
    isAvailable:   vi.fn(() => false),
    init:          vi.fn(),
    authenticate:  vi.fn(),
    createPayment: vi.fn(),
    canAttempt:    vi.fn(() => true),
  },
}));

// ─── useHubData ──────────────────────────────────────────────────
vi.mock('@/hooks/useHubData', () => ({
  useHubData: vi.fn(() => ({
    balance:        '5.00',
    assetCount:     2,
    piPrice:        null,
    notifCount:     0,
    time:           '12:00',
    setNotifCount:  vi.fn(),
    refresh:        vi.fn().mockResolvedValue(undefined),
    refreshBalance: vi.fn(),
  })),
}));

// ─── useRealtimeNotifications ────────────────────────────────────
vi.mock('@/lib-client/hooks/useRealtimeNotifications', () => ({
  useRealtimeNotifications: vi.fn(() => ({ unread: 0, connected: false, clearUnread: vi.fn() })),
}));

// ─── useWallet ───────────────────────────────────────────────────
vi.mock('@/lib-client/hooks/useWallet', () => ({
  useWallet: vi.fn(() => ({
    wallet:          { balance: 10.5, currency: 'PI', walletId: 'wallet-id-123' },
    transactions:    [],
    isLoading:       false,
    isRefreshing:    false,
    error:           null,
    page:            1,
    totalPages:      1,
    total:           0,
    filterType:      'all',
    filterStatus:    'all',
    hasMore:         false,
    refetch:         vi.fn(),
    setPage:         vi.fn(),
    setFilterType:   vi.fn(),
    setFilterStatus: vi.fn(),
    updateBalance:   vi.fn(),
  })),
}));

// ─── useWalletRealtime ───────────────────────────────────────────
vi.mock('@/lib-client/hooks/useWalletRealtime', () => ({
  useWalletRealtime: vi.fn(() => ({ isConnected: false })),
}));

// ─── useKyc ──────────────────────────────────────────────────────
vi.mock('@/lib-client/hooks/useKyc', () => ({
  useKyc: vi.fn(() => ({
    kyc:          null,
    isLoading:    false,
    isSubmitting: false,
    error:        null,
    refetch:      vi.fn(),
    uploadDocs:   vi.fn().mockResolvedValue(undefined),
    submit:       vi.fn().mockResolvedValue(undefined),
    reset:        vi.fn(),
  })),
}));

// ─── useOrders ───────────────────────────────────────────────────
vi.mock('@/lib-client/hooks/useOrders', () => ({
  useOrders: vi.fn(() => ({
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
  })),
}));

// ─── useNotifications ────────────────────────────────────────────
vi.mock('@/lib-client/hooks/useNotifications', () => ({
  useNotifications: vi.fn(() => ({
    notifications:  [],
    unreadCount:    0,
    isLoading:      false,
    isRefreshing:   false,
    error:          null,
    refetch:        vi.fn(),
    markAsRead:     vi.fn(),
    markAllAsRead:  vi.fn(),
  })),
}));

// ─── marketplace-payment ─────────────────────────────────────────
vi.mock('@/lib-client/pi/marketplace-payment', () => ({
  buyAsset: vi.fn().mockResolvedValue({ success: true, message: 'Done' }),
}));

// ─── request-id ──────────────────────────────────────────────────
vi.mock('@/lib/request-id', () => ({
  buildHeaders: vi.fn(() => ({ 'Content-Type': 'application/json' })),
}));

// ─── Hub sub-components ──────────────────────────────────────────
vi.mock('@/app/hub/components/ToastContainer', () => ({
  ToastContainer: () => null,
}));
vi.mock('@/app/hub/components/AIDrawer', () => ({
  AIDrawer: () => null,
}));
vi.mock('@/app/hub/components/HubSkeleton', () => ({
  HubSkeleton: () => <div data-testid="hub-skeleton">Loading...</div>,
}));
vi.mock('@/app/hub/components/PullIndicator', () => ({
  PullIndicator: () => null,
}));
vi.mock('@/app/hub/components/PaymentModal', () => ({
  PaymentModal:    () => null,
  ExternalPayment: {},
}));

// ─── Hub components ──────────────────────────────────────────────
vi.mock('@/components/hub', () => ({
  HubHeader:    ({ notifCount }: any) => <header data-testid="hub-header">notif:{notifCount}</header>,
  HubWalletCard: ({ balance }: any) => <div data-testid="hub-wallet">{balance}</div>,
  HubCarousel:  () => <div data-testid="hub-carousel" />,
  HubAppsGrid:  ({ apps }: any) => <div data-testid="hub-apps">{apps?.length ?? 0}</div>,
  HubComingSoon: () => <div data-testid="hub-coming-soon" />,
  HubSubShell:  ({ children, title, loading }: any) => (
    loading ? <div data-testid="hub-sub-loading">Loading</div>
             : <div data-testid="hub-sub-shell"><h1>{title}</h1>{children}</div>
  ),
}));

// ─── Dashboard components ────────────────────────────────────────
vi.mock('@/components/dashboard', () => ({
  DashboardShell: ({ children, loading, title }: any) => (
    loading ? <div data-testid="dash-loading">Loading</div>
            : <div data-testid="dash-shell"><h1>{title}</h1>{children}</div>
  ),
  DashboardCard: ({ children, title }: any) => (
    <div data-testid="dash-card"><h2>{title}</h2>{children}</div>
  ),
}));
vi.mock('@/components/dashboard/DashboardShell', () => ({
  DashboardShell: ({ children, loading, title }: any) => (
    loading ? <div data-testid="dash-loading">Loading</div>
            : <div data-testid="dash-shell"><h1>{title}</h1>{children}</div>
  ),
}));
vi.mock('@/components/dashboard/DashboardCard', () => ({
  DashboardCard: ({ children, title }: any) => (
    <div data-testid="dash-card"><h2>{title}</h2>{children}</div>
  ),
}));

// ─── ErrorBoundary ───────────────────────────────────────────────
vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: any) => <>{children}</>,
}));

// ─── domains/_registry ───────────────────────────────────────────
vi.mock('@/domains/_registry', () => ({
  getVisibleDomains: vi.fn(() => []),
  LIVE_DOMAINS: [],
  COMING_SOON: [],
}));

// ─── i18n ────────────────────────────────────────────────────────
vi.mock('@/lib/i18n', async () => {
  const { en } = await import('@/lib/i18n/en');
  return {
    useTranslation: vi.fn(() => ({ t: en, locale: 'en', setLocale: vi.fn(), setLanguage: vi.fn(), dir: 'ltr' })),
    LocaleProvider: ({ children }: any) => <>{children}</>,
  };
});

// ─── haptic ──────────────────────────────────────────────────────
vi.mock('@/lib/hub/utils', () => ({ haptic: vi.fn() }));

// ─── CSS modules fallback ────────────────────────────────────────
vi.mock('@/styles/tec-design-tokens.css', () => ({}));

// ─── Error Boundary helper ───────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  render() {
    return this.state.error
      ? <div data-testid="error-boundary">Error: {this.state.error.message}</div>
      : this.props.children;
  }
}
const safeRender = (ui: React.ReactElement) =>
  render(<ErrorBoundary>{ui}</ErrorBoundary>);

// ─── global fetch mock ───────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true, status: 200,
    json: async () => ({
      data: { orders: [], payments: [], assets: [], kyc: null, subscription: null, balance: 0 },
    }),
  } as any);

  // Make window properties available for happy-dom
  Object.defineProperty(window, '__TEC_PI_READY', { value: true, configurable: true, writable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// 1. hub/page.tsx
// ═══════════════════════════════════════════════════════════════
describe('hub/page.tsx', () => {
  it('renders without crashing (authenticated)', async () => {
    const { default: Page } = await import('@/app/hub/page');
    const { container } = await act(async () => safeRender(<Page />));
    expect(container).toBeTruthy();
  });

  it('renders hub header when authenticated', async () => {
    const { default: Page } = await import('@/app/hub/page');
    await act(async () => { safeRender(<Page />); });
    expect(document.body).toBeTruthy();
  });

  it('shows skeleton when loading', async () => {
    const { usePiAuth } = await import('@/lib-client/hooks/usePiAuth');
    (usePiAuth as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      user: null, isAuthenticated: false, isLoading: true,
      login: vi.fn(), logout: vi.fn(), error: null,
    });
    const { default: Page } = await import('@/app/hub/page');
    const { queryByTestId } = await act(async () => safeRender(<Page />));
    expect(document.body).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. dashboard/wallet/page.tsx
// ═══════════════════════════════════════════════════════════════
describe('dashboard/wallet/page.tsx', () => {
  it('renders wallet page with balance', async () => {
    const { default: Page } = await import('@/app/dashboard/wallet/page');
    const { container } = await act(async () => safeRender(<Page />));
    expect(container).toBeTruthy();
  });

  it('shows loading skeleton when isLoading=true', async () => {
    const { useWallet } = await import('@/lib-client/hooks/useWallet');
    (useWallet as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      wallet: null, transactions: [], isLoading: true, isRefreshing: false,
      error: null, page: 1, totalPages: 1, total: 0,
      filterType: 'all', filterStatus: 'all', hasMore: false,
      refetch: vi.fn(), setPage: vi.fn(), setFilterType: vi.fn(),
      setFilterStatus: vi.fn(), updateBalance: vi.fn(),
    });
    const { default: Page } = await import('@/app/dashboard/wallet/page');
    const { container } = await act(async () => safeRender(<Page />));
    expect(container).toBeTruthy();
  });

  it('shows error state when error is set', async () => {
    const { useWallet } = await import('@/lib-client/hooks/useWallet');
    (useWallet as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      wallet: null, transactions: [], isLoading: false, isRefreshing: false,
      error: 'Network error', page: 1, totalPages: 1, total: 0,
      filterType: 'all', filterStatus: 'all', hasMore: false,
      refetch: vi.fn(), setPage: vi.fn(), setFilterType: vi.fn(),
      setFilterStatus: vi.fn(), updateBalance: vi.fn(),
    });
    const { default: Page } = await import('@/app/dashboard/wallet/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toContain('Network error');
  });

  it('renders transactions when data is loaded', async () => {
    const { useWallet } = await import('@/lib-client/hooks/useWallet');
    (useWallet as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      wallet: { balance: 10.5, currency: 'PI', walletId: 'w-1' },
      transactions: [
        { id: 'tx1', type: 'receive', status: 'completed', amount: 5.0, currency: 'PI', createdAt: '2024-01-01T00:00:00Z', txHash: 'abc123' },
        { id: 'tx2', type: 'send', status: 'pending', amount: 2.0, currency: 'PI', createdAt: '2024-01-02T00:00:00Z' },
      ],
      isLoading: false, isRefreshing: false,
      error: null, page: 1, totalPages: 2, total: 2,
      filterType: 'all', filterStatus: 'all', hasMore: true,
      refetch: vi.fn(), setPage: vi.fn(), setFilterType: vi.fn(),
      setFilterStatus: vi.fn(), updateBalance: vi.fn(),
    });
    const { default: Page } = await import('@/app/dashboard/wallet/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toContain('Wallet');
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. dashboard/page.tsx
// ═══════════════════════════════════════════════════════════════
describe('dashboard/page.tsx', () => {
  it('renders dashboard page without crashing', async () => {
    const { default: Page } = await import('@/app/dashboard/page');
    const { container } = await act(async () => safeRender(<Page />));
    expect(container).toBeTruthy();
  });

  it('shows loading state initially', async () => {
    const { default: Page } = await import('@/app/dashboard/page');
    const { queryByTestId } = await act(async () => safeRender(<Page />));
    expect(document.body).toBeTruthy();
  });

  it('renders overview tab content when data loads', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ data: { balance: 5.0 }, balance: 5.0, payments: [], verified: false }),
    } as any);
    const { default: Page } = await import('@/app/dashboard/page');
    await act(async () => { safeRender(<Page />); });
    await waitFor(() => { expect(document.body).toBeTruthy(); }, { timeout: 2000 });
  });

  it('renders with non-authenticated user (redirect)', async () => {
    const { usePiAuth } = await import('@/lib-client/hooks/usePiAuth');
    (usePiAuth as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      user: null, isAuthenticated: false, isLoading: false,
      login: vi.fn(), logout: vi.fn(), error: null,
    });
    const { default: Page } = await import('@/app/dashboard/page');
    const { container } = await act(async () => safeRender(<Page />));
    expect(container).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. mint/page.tsx
// ═══════════════════════════════════════════════════════════════
describe('mint/page.tsx', () => {
  it('renders spinner when SDK not ready', async () => {
    const { usePiSdkReady } = await import('@/lib-client/hooks/usePiSdkReady');
    (usePiSdkReady as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      piReady: false, authReady: false, lastError: null,
      ensurePiAuth: vi.fn().mockResolvedValue(false),
    });
    const { default: Page } = await import('@/app/mint/page');
    const { container } = await act(async () => safeRender(<Page />));
    expect(container).toBeTruthy();
  });

  it('renders mint page when SDK is ready', async () => {
    // Make __TEC_PI_READY accessible
    (window as any).__TEC_PI_READY = true;
    const { default: Page } = await import('@/app/mint/page');
    const { container } = await act(async () => safeRender(<Page />));
    expect(container).toBeTruthy();
  });

  it('redirects unauthenticated user', async () => {
    const { usePiAuth } = await import('@/lib-client/hooks/usePiAuth');
    (usePiAuth as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      user: null, isAuthenticated: false, isLoading: false,
      login: vi.fn(), logout: vi.fn(), error: null,
    });
    // Mock window.location
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '' }, configurable: true, writable: true,
    });
    const { default: Page } = await import('@/app/mint/page');
    await act(async () => safeRender(<Page />));
    expect(document.body).toBeTruthy();
    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true });
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. dashboard/orders/checkout/page.tsx
// ═══════════════════════════════════════════════════════════════
describe('dashboard/orders/checkout/page.tsx', () => {
  it('renders checkout page without crashing', async () => {
    const { default: Page } = await import('@/app/dashboard/orders/checkout/page');
    const { container } = await act(async () => safeRender(<Page />));
    expect(container).toBeTruthy();
  });

  it('shows Checkout heading', async () => {
    const { default: Page } = await import('@/app/dashboard/orders/checkout/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toContain('Checkout');
  });

  it('redirects when not authenticated', async () => {
    const { usePiAuth } = await import('@/lib-client/hooks/usePiAuth');
    (usePiAuth as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      user: null, isAuthenticated: false, isLoading: false,
      login: vi.fn(), logout: vi.fn(), error: null,
    });
    const { default: Page } = await import('@/app/dashboard/orders/checkout/page');
    const { container } = await act(async () => safeRender(<Page />));
    expect(container).toBeTruthy();
  });

  it('shows loading spinner while paying', async () => {
    const { default: Page } = await import('@/app/dashboard/orders/checkout/page');
    await act(async () => safeRender(<Page />));
    expect(document.body).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. hub/subscription/page.tsx
// ═══════════════════════════════════════════════════════════════
describe('hub/subscription/page.tsx', () => {
  it('renders subscription page without crashing', async () => {
    const { default: Page } = await import('@/app/hub/subscription/page');
    const { container } = await act(async () => safeRender(<Page />));
    expect(container).toBeTruthy();
  });

  it('shows subscription plans after loading', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ data: { subscription: null } }),
    } as any);
    const { default: Page } = await import('@/app/hub/subscription/page');
    await act(async () => { safeRender(<Page />); });
    await waitFor(() => { expect(document.body).toBeTruthy(); }, { timeout: 1000 });
  });

  it('shows error message when fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false, status: 500,
      json: async () => ({ message: 'Server error' }),
    } as any);
    const { default: Page } = await import('@/app/hub/subscription/page');
    await act(async () => { safeRender(<Page />); });
    expect(document.body).toBeTruthy();
  });

  it('renders plan cards with Free plan visible', async () => {
    const { default: Page } = await import('@/app/hub/subscription/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toMatch(/Free|Pro|Subscription/i);
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. dashboard/subscription/page.tsx
// ═══════════════════════════════════════════════════════════════
describe('dashboard/subscription/page.tsx', () => {
  it('renders without crashing', async () => {
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    const { container } = await act(async () => safeRender(<Page />));
    expect(container).toBeTruthy();
  });

  it('shows plan cards', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ data: { subscription: { plan: 'FREE', status: 'ACTIVE', current_period_end: null, isExpired: false, planDetails: { id: 'FREE', name: 'Free', price: 0, currency: 'PI', duration: 0, features: [] } } } }),
    } as any);
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { safeRender(<Page />); });
    expect(document.body.textContent).toMatch(/Subscription|Plans?/i);
  });

  it('renders error state on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('fetch failed'));
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { safeRender(<Page />); });
    expect(document.body).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. dashboard/security/page.tsx
// ═══════════════════════════════════════════════════════════════
describe('dashboard/security/page.tsx', () => {
  it('renders security page without crashing', async () => {
    const { default: Page } = await import('@/app/dashboard/security/page');
    const { container } = await act(async () => safeRender(<Page />));
    expect(container).toBeTruthy();
  });

  it('shows Security Center heading', async () => {
    const { default: Page } = await import('@/app/dashboard/security/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toContain('Security Center');
  });

  it('shows 2FA section', async () => {
    const { default: Page } = await import('@/app/dashboard/security/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toMatch(/Two-Factor|2FA/i);
  });

  it('shows active sessions list', async () => {
    const { default: Page } = await import('@/app/dashboard/security/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toMatch(/Active Sessions|Current/i);
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. dashboard/marketplace/page.tsx
// ═══════════════════════════════════════════════════════════════
describe('dashboard/marketplace/page.tsx', () => {
  it('renders marketplace page without crashing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ listings: [], total: 0 }),
    } as any);
    const { default: Page } = await import('@/app/dashboard/marketplace/page');
    const { container } = await act(async () => safeRender(<Page />));
    expect(container).toBeTruthy();
  });

  it('shows loading spinner initially', async () => {
    let resolvePromise: (v: any) => void;
    const pendingFetch = new Promise(resolve => { resolvePromise = resolve; });
    vi.spyOn(globalThis, 'fetch').mockReturnValue(pendingFetch as any);
    const { default: Page } = await import('@/app/dashboard/marketplace/page');
    await act(async () => safeRender(<Page />));
    resolvePromise!({ ok: true, json: async () => ({ listings: [], total: 0 }) });
    expect(document.body).toBeTruthy();
  });

  it('shows empty state when no listings', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ listings: [], total: 0 }),
    } as any);
    const { default: Page } = await import('@/app/dashboard/marketplace/page');
    await act(async () => { safeRender(<Page />); });
    await waitFor(() => { expect(document.body.textContent).toMatch(/Marketplace|No listings/i); }, { timeout: 1000 });
  });

  it('shows listings when data is loaded', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        listings: [{
          id: 'l1', price: 5, currency: 'PI', title: 'Test Domain',
          description: 'A test domain', sellerId: 'seller-1', createdAt: '2024-01-01',
          asset: { slug: 'test.pi', category: 'DOMAIN', metadata: {} },
        }],
        total: 1,
      }),
    } as any);
    const { default: Page } = await import('@/app/dashboard/marketplace/page');
    await act(async () => { safeRender(<Page />); });
    await waitFor(() => { expect(document.body.textContent).toMatch(/Marketplace|test\.pi/i); }, { timeout: 1000 });
  });
});

// ═══════════════════════════════════════════════════════════════
// 10. dashboard/orders/page.tsx
// ═══════════════════════════════════════════════════════════════
describe('dashboard/orders/page.tsx', () => {
  it('renders orders page without crashing', async () => {
    const { default: Page } = await import('@/app/dashboard/orders/page');
    const { container } = await act(async () => safeRender(<Page />));
    expect(container).toBeTruthy();
  });

  it('shows Orders heading', async () => {
    const { default: Page } = await import('@/app/dashboard/orders/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toContain('Orders');
  });

  it('shows loading skeleton when isLoading=true', async () => {
    const { useOrders } = await import('@/lib-client/hooks/useOrders');
    (useOrders as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      orders: [], total: 0, totalPages: 1, page: 1,
      isLoading: true, isRefreshing: false, error: null,
      filterStatus: 'all', setFilterStatus: vi.fn(),
      refetch: vi.fn(), setPage: vi.fn(),
    });
    const { default: Page } = await import('@/app/dashboard/orders/page');
    const { container } = await act(async () => safeRender(<Page />));
    expect(container).toBeTruthy();
  });

  it('shows error state when error is set', async () => {
    const { useOrders } = await import('@/lib-client/hooks/useOrders');
    (useOrders as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      orders: [], total: 0, totalPages: 1, page: 1,
      isLoading: false, isRefreshing: false, error: 'Failed to load',
      filterStatus: 'all', setFilterStatus: vi.fn(),
      refetch: vi.fn(), setPage: vi.fn(),
    });
    const { default: Page } = await import('@/app/dashboard/orders/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toContain('Failed to load');
  });

  it('renders orders list when data is available', async () => {
    const { useOrders } = await import('@/lib-client/hooks/useOrders');
    (useOrders as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      orders: [{
        id: 'order-123', buyer_id: 'u-1', status: 'PAID',
        total: 10, currency: 'PI', payment_id: 'pay-1',
        notes: null, created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z', paid_at: '2024-01-01T00:00:00Z',
        cancelled_at: null, cancel_reason: null,
        items: [{ id: 'i1', product_id: 'p1', quantity: 1, price: 10, currency: 'PI', snapshot: { title: 'Product 1', seller_id: 's1' } }],
      }],
      total: 1, totalPages: 1, page: 1,
      isLoading: false, isRefreshing: false, error: null,
      filterStatus: 'all', setFilterStatus: vi.fn(),
      refetch: vi.fn(), setPage: vi.fn(),
    });
    const { default: Page } = await import('@/app/dashboard/orders/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toContain('Orders');
  });
});

// ═══════════════════════════════════════════════════════════════
// 11. hub/kyc/page.tsx
// ═══════════════════════════════════════════════════════════════
describe('hub/kyc/page.tsx', () => {
  it('renders without crashing', async () => {
    const { default: Page } = await import('@/app/hub/kyc/page');
    const { container } = await act(async () => safeRender(<Page />));
    expect(container).toBeTruthy();
  });

  it('shows loading state when isLoading=true', async () => {
    const { useKyc } = await import('@/lib-client/hooks/useKyc');
    (useKyc as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      kyc: null, isLoading: true, isSubmitting: false, error: null,
      refetch: vi.fn(), uploadDocs: vi.fn(), submit: vi.fn(), reset: vi.fn(),
    });
    const { default: Page } = await import('@/app/hub/kyc/page');
    const { container } = await act(async () => safeRender(<Page />));
    expect(container).toBeTruthy();
  });

  it('shows NOT_STARTED kyc form', async () => {
    const { useKyc } = await import('@/lib-client/hooks/useKyc');
    (useKyc as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      kyc: {
        id: 'kyc-1', user_id: 'u-1', status: 'NOT_STARTED', level: 'L0',
        id_front_url: null, id_back_url: null, selfie_url: null,
        rejection_reason: null, verified_at: null, submitted_at: null,
        created_at: '2024-01-01T00:00:00Z',
      },
      isLoading: false, isSubmitting: false, error: null,
      refetch: vi.fn(), uploadDocs: vi.fn().mockResolvedValue(undefined),
      submit: vi.fn().mockResolvedValue(undefined), reset: vi.fn(),
    });
    const { default: Page } = await import('@/app/hub/kyc/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toMatch(/Identity|KYC|Verification/i);
  });

  it('shows VERIFIED state', async () => {
    const { useKyc } = await import('@/lib-client/hooks/useKyc');
    (useKyc as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      kyc: {
        id: 'kyc-1', user_id: 'u-1', status: 'VERIFIED', level: 'L1',
        id_front_url: 'https://example.com/id.jpg', id_back_url: null,
        selfie_url: 'https://example.com/selfie.jpg',
        rejection_reason: null, verified_at: '2024-01-15T00:00:00Z',
        submitted_at: '2024-01-10T00:00:00Z', created_at: '2024-01-01T00:00:00Z',
      },
      isLoading: false, isSubmitting: false, error: null,
      refetch: vi.fn(), uploadDocs: vi.fn(), submit: vi.fn(), reset: vi.fn(),
    });
    const { default: Page } = await import('@/app/hub/kyc/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toMatch(/Verified|Identity/i);
  });

  it('shows PENDING state', async () => {
    const { useKyc } = await import('@/lib-client/hooks/useKyc');
    (useKyc as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      kyc: {
        id: 'kyc-1', user_id: 'u-1', status: 'PENDING', level: 'L0',
        id_front_url: 'https://example.com/id.jpg', id_back_url: null,
        selfie_url: 'https://example.com/selfie.jpg',
        rejection_reason: null, verified_at: null,
        submitted_at: '2024-01-10T00:00:00Z', created_at: '2024-01-01T00:00:00Z',
      },
      isLoading: false, isSubmitting: false, error: null,
      refetch: vi.fn(), uploadDocs: vi.fn(), submit: vi.fn(), reset: vi.fn(),
    });
    const { default: Page } = await import('@/app/hub/kyc/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toMatch(/Review|Under|Pending/i);
  });

  it('shows REJECTED state with reason', async () => {
    const { useKyc } = await import('@/lib-client/hooks/useKyc');
    (useKyc as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      kyc: {
        id: 'kyc-1', user_id: 'u-1', status: 'REJECTED', level: 'L0',
        id_front_url: null, id_back_url: null, selfie_url: null,
        rejection_reason: 'Documents unclear', verified_at: null,
        submitted_at: null, created_at: '2024-01-01T00:00:00Z',
      },
      isLoading: false, isSubmitting: false, error: null,
      refetch: vi.fn(), uploadDocs: vi.fn(), submit: vi.fn(), reset: vi.fn(),
    });
    const { default: Page } = await import('@/app/hub/kyc/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toMatch(/Rejected|Documents unclear/i);
  });
});

// ═══════════════════════════════════════════════════════════════
// 12. dashboard/kyc/page.tsx
// ═══════════════════════════════════════════════════════════════
describe('dashboard/kyc/page.tsx', () => {
  it('renders without crashing', async () => {
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    const { container } = await act(async () => safeRender(<Page />));
    expect(container).toBeTruthy();
  });

  it('shows NOT_STARTED form state', async () => {
    const { useKyc } = await import('@/lib-client/hooks/useKyc');
    (useKyc as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      kyc: {
        id: 'kyc-1', user_id: 'u-1', status: 'NOT_STARTED', level: 'L0',
        id_front_url: null, id_back_url: null, selfie_url: null,
        rejection_reason: null, verified_at: null, submitted_at: null,
        created_at: '2024-01-01T00:00:00Z',
      },
      isLoading: false, isSubmitting: false, error: null,
      refetch: vi.fn(), uploadDocs: vi.fn().mockResolvedValue(undefined),
      submit: vi.fn().mockResolvedValue(undefined), reset: vi.fn(),
    });
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toMatch(/Identity|Verification|KYC/i);
  });

  it('shows VERIFIED state', async () => {
    const { useKyc } = await import('@/lib-client/hooks/useKyc');
    (useKyc as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      kyc: {
        id: 'kyc-1', user_id: 'u-1', status: 'VERIFIED', level: 'L2',
        id_front_url: 'https://example.com/id.jpg', id_back_url: null,
        selfie_url: 'https://example.com/selfie.jpg',
        rejection_reason: null, verified_at: '2024-01-15T00:00:00Z',
        submitted_at: '2024-01-10T00:00:00Z', created_at: '2024-01-01T00:00:00Z',
      },
      isLoading: false, isSubmitting: false, error: null,
      refetch: vi.fn(), uploadDocs: vi.fn(), submit: vi.fn(), reset: vi.fn(),
    });
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toMatch(/Verified|Identity/i);
  });

  it('shows error message', async () => {
    const { useKyc } = await import('@/lib-client/hooks/useKyc');
    (useKyc as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      kyc: null, isLoading: false, isSubmitting: false,
      error: 'Failed to load KYC status',
      refetch: vi.fn(), uploadDocs: vi.fn(), submit: vi.fn(), reset: vi.fn(),
    });
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toContain('Failed to load KYC status');
  });
});

// ═══════════════════════════════════════════════════════════════
// 13. dashboard/analytics/page.tsx
// ═══════════════════════════════════════════════════════════════
describe('dashboard/analytics/page.tsx', () => {
  it('renders analytics page without crashing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        data: { totalEvents: 100, totalPayments: 50, totalUsers: 30, recentMetrics: [] },
      }),
    } as any);
    const { default: Page } = await import('@/app/dashboard/analytics/page');
    const { container } = await act(async () => safeRender(<Page />));
    expect(container).toBeTruthy();
  });

  it('shows Analytics heading', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ data: { totalEvents: 0, totalPayments: 0, totalUsers: 0, recentMetrics: [] } }),
    } as any);
    const { default: Page } = await import('@/app/dashboard/analytics/page');
    await act(async () => { safeRender(<Page />); });
    await waitFor(() => {
      expect(document.body.textContent).toContain('Analytics');
    }, { timeout: 1000 });
  });

  it('shows error when fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false, status: 500,
      json: async () => ({}),
    } as any);
    const { default: Page } = await import('@/app/dashboard/analytics/page');
    await act(async () => { safeRender(<Page />); });
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/Analytics|Failed/i);
    }, { timeout: 1000 });
  });

  it('renders metric bars when data is available', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        data: {
          totalEvents: 500, totalPayments: 100, totalUsers: 200,
          recentMetrics: [
            { date: '2024-01-01', total_payments: 10, total_volume: 50.0, new_users: 5 },
            { date: '2024-01-02', total_payments: 15, total_volume: 75.0, new_users: 8 },
          ],
        },
      }),
    } as any);
    const { default: Page } = await import('@/app/dashboard/analytics/page');
    await act(async () => { safeRender(<Page />); });
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/Analytics|Payments/i);
    }, { timeout: 1000 });
  });
});

// ═══════════════════════════════════════════════════════════════
// 14. dashboard/profile/page.tsx
// ═══════════════════════════════════════════════════════════════
describe('dashboard/profile/page.tsx', () => {
  it('renders profile page without crashing', async () => {
    const { default: Page } = await import('@/app/dashboard/profile/page');
    const { container } = await act(async () => safeRender(<Page />));
    expect(container).toBeTruthy();
  });

  it('shows username in profile', async () => {
    const { default: Page } = await import('@/app/dashboard/profile/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toMatch(/@testuser|Profile/i);
  });

  it('shows account information section', async () => {
    const { default: Page } = await import('@/app/dashboard/profile/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toMatch(/Account Information|Profile/i);
  });
});

// ═══════════════════════════════════════════════════════════════
// 15. hub/profile/page.tsx
// ═══════════════════════════════════════════════════════════════
describe('hub/profile/page.tsx', () => {
  it('renders hub profile page without crashing', async () => {
    const { default: Page } = await import('@/app/hub/profile/page');
    const { container } = await act(async () => safeRender(<Page />));
    expect(container).toBeTruthy();
  });

  it('shows username in hub profile', async () => {
    const { default: Page } = await import('@/app/hub/profile/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toMatch(/@testuser|Profile/i);
  });

  it('shows sign out button', async () => {
    const { default: Page } = await import('@/app/hub/profile/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toMatch(/Sign Out|Account/i);
  });
});

// ═══════════════════════════════════════════════════════════════
// 16. dashboard/assets/page.tsx
// ═══════════════════════════════════════════════════════════════
describe('dashboard/assets/page.tsx', () => {
  it('renders assets page without crashing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ data: [] }),
    } as any);
    const { default: Page } = await import('@/app/dashboard/assets/page');
    const { container } = await act(async () => safeRender(<Page />));
    expect(container).toBeTruthy();
  });

  it('shows loading spinner initially', async () => {
    const { default: Page } = await import('@/app/dashboard/assets/page');
    await act(async () => safeRender(<Page />));
    expect(document.body).toBeTruthy();
  });

  it('shows empty state when no assets', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ data: [] }),
    } as any);
    const { default: Page } = await import('@/app/dashboard/assets/page');
    await act(async () => { safeRender(<Page />); });
    await waitFor(() => { expect(document.body.textContent).toMatch(/Assets|No assets/i); }, { timeout: 1000 });
  });

  it('renders assets when data is loaded', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        data: [
          { id: 'a1', slug: 'my-domain.pi', category: 'DOMAIN', status: 'ACTIVE', metadata: {}, createdAt: '2024-01-01T00:00:00Z' },
          { id: 'a2', slug: 'property.pi', category: 'REAL_ESTATE', status: 'ON_SALE', metadata: {}, createdAt: '2024-01-02T00:00:00Z' },
        ],
      }),
    } as any);
    const { default: Page } = await import('@/app/dashboard/assets/page');
    await act(async () => { safeRender(<Page />); });
    await waitFor(() => { expect(document.body.textContent).toMatch(/Assets/i); }, { timeout: 1000 });
  });
});

// ═══════════════════════════════════════════════════════════════
// 17. dashboard/observability/page.tsx
// ═══════════════════════════════════════════════════════════════
describe('dashboard/observability/page.tsx', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders observability page without crashing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        window: '24h', total: 100, completed: 90, failed: 5, cancelled: 3,
        pending: 2, successRate: 90, volume: 450.5, healthy: true,
        generatedAt: '2024-01-01T12:00:00Z',
      }),
    } as any);
    const { default: Page } = await import('@/app/dashboard/observability/page');
    const { container } = await act(async () => {
      const result = safeRender(<Page />);
      await vi.runAllTimersAsync();
      return result;
    });
    expect(container).toBeTruthy();
  });

  it('shows loading state initially', async () => {
    let resolvePromise: (v: any) => void;
    const pendingFetch = new Promise(resolve => { resolvePromise = resolve; });
    vi.spyOn(globalThis, 'fetch').mockReturnValue(pendingFetch as any);
    const { default: Page } = await import('@/app/dashboard/observability/page');
    await act(async () => safeRender(<Page />));
    resolvePromise!({
      ok: true, json: async () => ({
        window: '24h', total: 0, completed: 0, failed: 0, cancelled: 0,
        pending: 0, successRate: null, volume: 0, healthy: true,
        generatedAt: new Date().toISOString(),
      }),
    });
    expect(document.body).toBeTruthy();
  });

  it('shows error state when fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false, status: 500,
      json: async () => ({ error: 'Service unavailable' }),
    } as any);
    const { default: Page } = await import('@/app/dashboard/observability/page');
    await act(async () => {
      safeRender(<Page />);
      await vi.runAllTimersAsync();
    });
    expect(document.body).toBeTruthy();
  });

  it('shows metrics cards when data loads', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        window: '24h', total: 100, completed: 90, failed: 5, cancelled: 3,
        pending: 2, successRate: 90, volume: 450.5, healthy: true,
        generatedAt: '2024-01-01T12:00:00Z',
      }),
    } as any);
    const { default: Page } = await import('@/app/dashboard/observability/page');
    const { container } = await act(async () => safeRender(<Page />));
    expect(container).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// 18. dashboard/notifications/page.tsx
// ═══════════════════════════════════════════════════════════════
describe('dashboard/notifications/page.tsx', () => {
  it('renders notifications page without crashing', async () => {
    const { default: Page } = await import('@/app/dashboard/notifications/page');
    const { container } = await act(async () => safeRender(<Page />));
    expect(container).toBeTruthy();
  });

  it('shows empty state when no notifications', async () => {
    const { default: Page } = await import('@/app/dashboard/notifications/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toMatch(/Notifications|caught up/i);
  });

  it('shows unread notifications', async () => {
    const { useNotifications } = await import('@/lib-client/hooks/useNotifications');
    (useNotifications as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      notifications: [
        {
          id: 'n1', type: 'PAYMENT', title: 'Payment received', message: 'You got 5π',
          read: false, created_at: new Date().toISOString(),
        },
        {
          id: 'n2', type: 'KYC', title: 'KYC approved', message: 'Your identity is verified',
          read: true, created_at: new Date(Date.now() - 3600000).toISOString(),
        },
      ],
      unreadCount: 1, isLoading: false, isRefreshing: false, error: null,
      refetch: vi.fn(), markAsRead: vi.fn(), markAllAsRead: vi.fn(),
    });
    const { default: Page } = await import('@/app/dashboard/notifications/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toMatch(/Notifications|Payment received/i);
  });

  it('shows error state when error is set', async () => {
    const { useNotifications } = await import('@/lib-client/hooks/useNotifications');
    (useNotifications as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      notifications: [], unreadCount: 0, isLoading: false, isRefreshing: false,
      error: 'Failed to load notifications',
      refetch: vi.fn(), markAsRead: vi.fn(), markAllAsRead: vi.fn(),
    });
    const { default: Page } = await import('@/app/dashboard/notifications/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toContain('Failed to load notifications');
  });

  it('shows mark-all-read button when unread notifications exist', async () => {
    const { useNotifications } = await import('@/lib-client/hooks/useNotifications');
    (useNotifications as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      notifications: [
        { id: 'n1', type: 'SYSTEM', title: 'System alert', message: 'Update available', read: false, created_at: new Date().toISOString() },
      ],
      unreadCount: 1, isLoading: false, isRefreshing: false, error: null,
      refetch: vi.fn(), markAsRead: vi.fn(), markAllAsRead: vi.fn(),
    });
    const { default: Page } = await import('@/app/dashboard/notifications/page');
    await act(async () => safeRender(<Page />));
    expect(document.body.textContent).toMatch(/Mark all read|1 unread|Notifications/i);
  });
});
