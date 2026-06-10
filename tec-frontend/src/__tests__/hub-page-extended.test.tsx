/**
 * Extended tests for HubPage (src/app/hub/page.tsx).
 * Targets uncovered branches: loading state, unauthenticated redirect,
 * pending payment loading screen, nav bar clicks, AI drawer toggle,
 * pull-to-refresh, notification click, carousel auto-advance,
 * URL params parsing (pay=1), payment create success/failure, handlePaymentSuccess.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

// ── next/navigation ────────────────────────────────────────────────
const mockPush    = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

// ── Hoisted mock factories ─────────────────────────────────────────
const mockUsePiAuth      = vi.hoisted(() => vi.fn());
const mockUsePiSdkReady  = vi.hoisted(() => vi.fn());
const mockUseHubData     = vi.hoisted(() => vi.fn());
const mockUseRealtime    = vi.hoisted(() => vi.fn());
const mockGetStoredUser  = vi.hoisted(() => vi.fn());
const mockGetAccessToken = vi.hoisted(() => vi.fn());

vi.mock('@/lib-client/hooks/usePiAuth', () => ({
  usePiAuth: mockUsePiAuth,
}));

vi.mock('@/lib-client/hooks/usePiSdkReady', () => ({
  usePiSdkReady: mockUsePiSdkReady,
}));

vi.mock('@/lib-client/hooks/useRealtimeNotifications', () => ({
  useRealtimeNotifications: mockUseRealtime,
}));

vi.mock('@/hooks/useHubData', () => ({
  useHubData: mockUseHubData,
}));

vi.mock('@/lib-client/pi/pi-auth', () => ({
  getStoredUser:  mockGetStoredUser,
  getAccessToken: mockGetAccessToken,
  loginWithPi:    vi.fn(),
  logout:         vi.fn(),
  isPiBrowser:    vi.fn(() => false),
}));

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

vi.mock('@/lib/hub/utils', () => ({ haptic: vi.fn() }));

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t:    { common: { loading: 'Loading...' }, dashboard: {}, apps: {} },
    locale: 'en',
    setLanguage: vi.fn(),
    dir:  'ltr',
  }),
  LocaleProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── Stub hub sub-components so we don't need their deps ────────────
vi.mock('@/components/hub', () => ({
  HubHeader:    ({ piUsername, notifCount, onNotifClick }: any) => (
    <div data-testid="hub-header">
      <span data-testid="hub-username">{piUsername}</span>
      <span data-testid="hub-notif-count">{notifCount}</span>
      <button data-testid="notif-btn" onClick={onNotifClick}>Notif</button>
    </div>
  ),
  HubWalletCard: ({ balance }: any) => (
    <div data-testid="hub-wallet">{balance}</div>
  ),
  HubCarousel:  ({ goToAssets, goToCommerce, setCarouselIdx }: any) => (
    <div data-testid="hub-carousel">
      <button data-testid="go-assets"   onClick={goToAssets}>Assets</button>
      <button data-testid="go-commerce" onClick={goToCommerce}>Commerce</button>
      <button data-testid="carousel-dot" onClick={() => setCarouselIdx(1)}>Dot</button>
    </div>
  ),
  HubAppsGrid:  ({ apps }: any) => (
    <div data-testid="hub-apps-grid">{apps?.length ?? 0} apps</div>
  ),
  HubComingSoon: () => <div data-testid="hub-coming-soon" />,
}));

vi.mock('@/app/hub/components/ToastContainer', () => ({
  ToastContainer: ({ toasts, onDismiss }: any) => (
    <div data-testid="toast-container">
      {toasts.map((t: any) => (
        <div key={t.id} data-testid={`toast-${t.type}`}>
          {t.message}
          <button onClick={() => onDismiss(t.id)}>Dismiss</button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/app/hub/components/AIDrawer', () => ({
  AIDrawer: ({ open, onClose }: any) => (
    open ? <div data-testid="ai-drawer"><button onClick={onClose}>Close AI</button></div> : null
  ),
}));

vi.mock('@/app/hub/components/HubSkeleton', () => ({
  HubSkeleton: () => <div data-testid="hub-skeleton">Loading...</div>,
}));

vi.mock('@/app/hub/components/PullIndicator', () => ({
  PullIndicator: ({ progress, refreshing }: any) => (
    <div data-testid="pull-indicator" data-progress={progress} data-refreshing={refreshing} />
  ),
}));

vi.mock('@/app/hub/components/PaymentModal', () => ({
  PaymentModal: ({ payment, onClose, onSuccess }: any) => (
    <div data-testid="payment-modal">
      <span data-testid="payment-amount">{payment.amount}</span>
      <button data-testid="payment-close"  onClick={onClose}>Close</button>
      <button data-testid="payment-success" onClick={() => onSuccess('tx-123', 'pay-456')}>Success</button>
    </div>
  ),
  ExternalPayment: {},
}));

vi.mock('@/domains/_registry', () => ({
  getVisibleDomains: vi.fn(() => []),
  LIVE_DOMAINS:      [],
  COMING_SOON:       [],
}));

vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: any) => <>{children}</>,
}));

// ── Default mock return values ─────────────────────────────────────

const defaultUser = {
  id:               'u1',
  piUsername:       'alice',
  subscriptionPlan: 'Free',
  kycVerified:      false,
};

const defaultAuthState = {
  user:            defaultUser,
  isAuthenticated: true,
  isLoading:       false,
  login:           vi.fn(),
  logout:          vi.fn(),
  error:           null,
};

const defaultHubData = {
  balance:        '5.50',
  assetCount:     3,
  piPrice:        null,
  notifCount:     0,
  time:           '12:00',
  setNotifCount:  vi.fn(),
  refresh:        vi.fn().mockResolvedValue(undefined),
  refreshBalance: vi.fn(),
};

const defaultSdkReady = {
  piReady:       false,
  authReady:     false,
  lastError:     null,
  ensurePiAuth:  vi.fn(),
};

const defaultRealtime = {
  unread:      0,
  connected:   false,
  clearUnread: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();

  mockUsePiAuth.mockReturnValue(defaultAuthState);
  mockUsePiSdkReady.mockReturnValue(defaultSdkReady);
  mockUseHubData.mockReturnValue(defaultHubData);
  mockUseRealtime.mockReturnValue(defaultRealtime);
  mockGetStoredUser.mockReturnValue({ id: 'u1', piUsername: 'alice' });
  mockGetAccessToken.mockReturnValue('tok-123');

  // Reset window.location
  Object.defineProperty(window, 'location', {
    value:        { href: '/', search: '', replace: vi.fn() },
    writable:     true,
    configurable: true,
  });

  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok:   true,
    json: async () => ({}),
  } as any);
});

// ── Lazy import (required by project pattern) ──────────────────────
async function getPage() {
  const { default: HubPage } = await import('@/app/hub/page');
  return HubPage;
}

// ─────────────────────────────────────────────────────────────────
// 1. Loading state
// ─────────────────────────────────────────────────────────────────
describe('HubPage — loading state', () => {
  it('renders HubSkeleton when isLoading=true', async () => {
    mockUsePiAuth.mockReturnValue({ ...defaultAuthState, isLoading: true });
    const HubPage = await getPage();
    render(<HubPage />);
    expect(screen.getByTestId('hub-skeleton')).toBeInTheDocument();
  });

  it('renders HubSkeleton when not authenticated and no pendingPayment', async () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultAuthState,
      user:            null,
      isAuthenticated: false,
      isLoading:       false,
    });
    const HubPage = await getPage();
    render(<HubPage />);
    expect(screen.getByTestId('hub-skeleton')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// 2. Auth guard redirect
// ─────────────────────────────────────────────────────────────────
describe('HubPage — auth guard', () => {
  it('redirects to "/" when not authenticated after load', async () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultAuthState,
      user:            null,
      isAuthenticated: false,
      isLoading:       false,
    });
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('does NOT redirect when authenticated', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────
// 3. Authenticated hub render
// ─────────────────────────────────────────────────────────────────
describe('HubPage — authenticated render', () => {
  it('renders hub header', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    expect(screen.getByTestId('hub-header')).toBeInTheDocument();
  });

  it('renders user piUsername in hub header', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    expect(screen.getByTestId('hub-username')).toHaveTextContent('alice');
  });

  it('renders wallet card with balance', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    expect(screen.getByTestId('hub-wallet')).toHaveTextContent('5.50');
  });

  it('renders carousel', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    expect(screen.getByTestId('hub-carousel')).toBeInTheDocument();
  });

  it('renders apps grid', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    expect(screen.getByTestId('hub-apps-grid')).toBeInTheDocument();
  });

  it('renders coming soon section', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    expect(screen.getByTestId('hub-coming-soon')).toBeInTheDocument();
  });

  it('renders AI floating button', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    expect(screen.getByLabelText('Open AI assistant')).toBeInTheDocument();
  });

  it('renders bottom nav bar', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('renders all 5 bottom nav items', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    const nav = ['Hub', 'Wallet', 'Assets', 'Commerce', 'Settings'];
    for (const label of nav) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('Hub nav item has aria-current=page', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    expect(screen.getByLabelText('Hub')).toHaveAttribute('aria-current', 'page');
  });

  it('other nav items do NOT have aria-current', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    expect(screen.getByLabelText('Wallet')).not.toHaveAttribute('aria-current', 'page');
  });

  it('renders ToastContainer', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    expect(screen.getByTestId('toast-container')).toBeInTheDocument();
  });

  it('renders PullIndicator', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    expect(screen.getByTestId('pull-indicator')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// 4. Bottom navigation clicks
// ─────────────────────────────────────────────────────────────────
describe('HubPage — bottom navigation', () => {
  it('Wallet nav click calls router.push(/dashboard/wallet)', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    fireEvent.click(screen.getByLabelText('Wallet'));
    expect(mockPush).toHaveBeenCalledWith('/dashboard/wallet');
  });

  it('Settings nav click calls router.push(/hub/profile)', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    fireEvent.click(screen.getByLabelText('Settings'));
    expect(mockPush).toHaveBeenCalledWith('/hub/profile');
  });

  it('Assets nav click sets window.location.href to SSO assets URL', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    fireEvent.click(screen.getByLabelText('Assets'));
    expect(window.location.href).toContain('/api/auth/sso');
    expect(window.location.href).toContain('assets.tecosystem.app');
  });

  it('Commerce nav click sets window.location.href to SSO commerce URL', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    fireEvent.click(screen.getByLabelText('Commerce'));
    expect(window.location.href).toContain('/api/auth/sso');
    expect(window.location.href).toContain('commerce.tecosystem.app');
  });

  it('Carousel goToAssets click navigates to Assets SSO', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    fireEvent.click(screen.getByTestId('go-assets'));
    expect(window.location.href).toContain('assets.tecosystem.app');
  });

  it('Carousel goToCommerce click navigates to Commerce SSO', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    fireEvent.click(screen.getByTestId('go-commerce'));
    expect(window.location.href).toContain('commerce.tecosystem.app');
  });
});

// ─────────────────────────────────────────────────────────────────
// 5. AI Drawer toggle
// ─────────────────────────────────────────────────────────────────
describe('HubPage — AI drawer', () => {
  it('AI drawer is initially closed', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    expect(screen.queryByTestId('ai-drawer')).not.toBeInTheDocument();
  });

  it('clicking AI float button opens drawer', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    fireEvent.click(screen.getByLabelText('Open AI assistant'));
    expect(screen.getByTestId('ai-drawer')).toBeInTheDocument();
  });

  it('closing AI drawer hides it and shows float button again', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    fireEvent.click(screen.getByLabelText('Open AI assistant'));
    expect(screen.getByTestId('ai-drawer')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Close AI'));
    expect(screen.queryByTestId('ai-drawer')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Open AI assistant')).toBeInTheDocument();
  });

  it('AI float button hidden when drawer is open', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    fireEvent.click(screen.getByLabelText('Open AI assistant'));
    expect(screen.queryByLabelText('Open AI assistant')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// 6. Notification click
// ─────────────────────────────────────────────────────────────────
describe('HubPage — notifications', () => {
  it('notif button click navigates to /hub/notifications', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    fireEvent.click(screen.getByTestId('notif-btn'));
    expect(mockPush).toHaveBeenCalledWith('/hub/notifications');
  });

  it('shows ws unread count when wsUnread > 0', async () => {
    mockUseRealtime.mockReturnValue({ unread: 5, connected: true, clearUnread: vi.fn() });
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    expect(screen.getByTestId('hub-notif-count')).toHaveTextContent('5');
  });

  it('falls back to notifCount when wsUnread is 0', async () => {
    mockUseRealtime.mockReturnValue({ unread: 0, connected: false, clearUnread: vi.fn() });
    mockUseHubData.mockReturnValue({ ...defaultHubData, notifCount: 3 });
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    expect(screen.getByTestId('hub-notif-count')).toHaveTextContent('3');
  });
});

// ─────────────────────────────────────────────────────────────────
// 7. Pull-to-refresh
// ─────────────────────────────────────────────────────────────────
describe('HubPage — pull to refresh', () => {
  it('full pull (>= threshold) calls refresh and shows toast', async () => {
    const refreshMock = vi.fn().mockResolvedValue(undefined);
    mockUseHubData.mockReturnValue({ ...defaultHubData, refresh: refreshMock });

    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });

    const container = document.querySelector('[style*="overscroll-behavior"]') as HTMLElement;
    expect(container).toBeTruthy();

    // Start pull at y=0, scrollTop=0
    fireEvent.touchStart(container, { touches: [{ clientY: 0 }] });
    // Move 200px down (> 80 threshold → progress = 1)
    fireEvent.touchMove(container, { touches: [{ clientY: 200 }] });

    await act(async () => {
      fireEvent.touchEnd(container);
    });

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it('partial pull (< threshold) does NOT call refresh', async () => {
    const refreshMock = vi.fn().mockResolvedValue(undefined);
    mockUseHubData.mockReturnValue({ ...defaultHubData, refresh: refreshMock });

    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });

    const container = document.querySelector('[style*="overscroll-behavior"]') as HTMLElement;

    fireEvent.touchStart(container, { touches: [{ clientY: 0 }] });
    // Move only 20px (< 80 threshold)
    fireEvent.touchMove(container, { touches: [{ clientY: 20 }] });
    await act(async () => { fireEvent.touchEnd(container); });

    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('touchMove when not pulling does nothing (isPulling.current=false)', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });

    const container = document.querySelector('[style*="overscroll-behavior"]') as HTMLElement;

    // TouchMove without a prior TouchStart that triggers pulling
    fireEvent.touchMove(container, { touches: [{ clientY: 300 }] });

    // No crash expected
    expect(screen.getByTestId('pull-indicator')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// 8. Pending payment — URL params branch
// ─────────────────────────────────────────────────────────────────
describe('HubPage — URL params payment flow', () => {
  it('shows "Preparing payment..." when authenticated and pendingPayment is set', async () => {
    // Set ?pay=1&amount=5 in URL before rendering
    Object.defineProperty(window, 'location', {
      value: {
        href:    'http://localhost/hub?pay=1&amount=5&memo=Test&return_url=https%3A%2F%2Fcommerce.tecosystem.app&source=commerce',
        search:  '?pay=1&amount=5&memo=Test&return_url=https%3A%2F%2Fcommerce.tecosystem.app&source=commerce',
        replace: vi.fn(),
      },
      writable:     true,
      configurable: true,
    });

    // piReady=false → pendingPayment stays, no fetch yet
    mockUsePiSdkReady.mockReturnValue({ ...defaultSdkReady, piReady: false });

    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });

    expect(screen.getByText('Preparing payment...')).toBeInTheDocument();
  });

  it('ignores pay=1 when amount is 0', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        href:   'http://localhost/hub?pay=1&amount=0',
        search: '?pay=1&amount=0',
      },
      writable:     true,
      configurable: true,
    });

    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });

    // Should render normally (no pending payment)
    expect(screen.queryByText('Preparing payment...')).not.toBeInTheDocument();
    expect(screen.getByTestId('hub-header')).toBeInTheDocument();
  });

  it('shows Preparing payment for unauthenticated + pendingPayment (SSO in progress)', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        href:    'http://localhost/hub?pay=1&amount=5&return_url=https%3A%2F%2Fcommerce.tecosystem.app&source=commerce',
        search:  '?pay=1&amount=5&return_url=https%3A%2F%2Fcommerce.tecosystem.app&source=commerce',
        replace: vi.fn(),
      },
      writable:     true,
      configurable: true,
    });

    // Not authenticated, piReady=false
    mockUsePiAuth.mockReturnValue({
      ...defaultAuthState,
      user:            null,
      isAuthenticated: false,
      isLoading:       false,
    });
    mockUsePiSdkReady.mockReturnValue({ ...defaultSdkReady, piReady: false });

    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });

    expect(screen.getByText('Preparing payment...')).toBeInTheDocument();
  });

  it('piReady=true + pendingPayment → calls /api/payment/create', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        href:    'http://localhost/hub?pay=1&amount=5&return_url=https%3A%2F%2Fcommerce.tecosystem.app',
        search:  '?pay=1&amount=5&return_url=https%3A%2F%2Fcommerce.tecosystem.app',
        replace: vi.fn(),
      },
      writable:     true,
      configurable: true,
    });

    mockUsePiSdkReady.mockReturnValue({ ...defaultSdkReady, piReady: true });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok:   true,
      json: async () => ({ data: { payment: { id: 'internal-id-1' } } }),
    } as any);

    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/payment/create',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('piReady=true + pendingPayment + create success → shows PaymentModal', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        href:    'http://localhost/hub?pay=1&amount=5&return_url=https%3A%2F%2Fcommerce.tecosystem.app',
        search:  '?pay=1&amount=5&return_url=https%3A%2F%2Fcommerce.tecosystem.app',
        replace: vi.fn(),
      },
      writable:     true,
      configurable: true,
    });

    mockUsePiSdkReady.mockReturnValue({ ...defaultSdkReady, piReady: true });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok:   true,
      json: async () => ({ data: { payment: { id: 'internal-id-1' } } }),
    } as any);

    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });

    await waitFor(() => {
      expect(screen.getByTestId('payment-modal')).toBeInTheDocument();
    });
  });

  it('create returns no internalId → redirects with error', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        href:    'http://localhost/hub?pay=1&amount=5&return_url=https%3A%2F%2Fcommerce.tecosystem.app',
        search:  '?pay=1&amount=5&return_url=https%3A%2F%2Fcommerce.tecosystem.app',
        replace: vi.fn(),
      },
      writable:     true,
      configurable: true,
    });

    mockUsePiSdkReady.mockReturnValue({ ...defaultSdkReady, piReady: true });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok:   true,
      json: async () => ({ data: null }),
    } as any);

    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });

    await waitFor(() => {
      expect(window.location.href).toContain('payment_status=error');
    });
  });

  it('create throws → redirects with error', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        href:    'http://localhost/hub?pay=1&amount=5&return_url=https%3A%2F%2Fcommerce.tecosystem.app',
        search:  '?pay=1&amount=5&return_url=https%3A%2F%2Fcommerce.tecosystem.app',
        replace: vi.fn(),
      },
      writable:     true,
      configurable: true,
    });

    mockUsePiSdkReady.mockReturnValue({ ...defaultSdkReady, piReady: true });

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });

    await waitFor(() => {
      expect(window.location.href).toContain('payment_status=error');
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// 9. PaymentModal close + success (externalPayment)
// ─────────────────────────────────────────────────────────────────
describe('HubPage — PaymentModal interaction', () => {
  const setupPaymentModal = async () => {
    Object.defineProperty(window, 'location', {
      value: {
        href:    'http://localhost/hub?pay=1&amount=5&return_url=https%3A%2F%2Fcommerce.tecosystem.app',
        search:  '?pay=1&amount=5&return_url=https%3A%2F%2Fcommerce.tecosystem.app',
        replace: vi.fn(),
      },
      writable:     true,
      configurable: true,
    });

    mockUsePiSdkReady.mockReturnValue({ ...defaultSdkReady, piReady: true });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok:   true,
      json: async () => ({ data: { payment: { id: 'internal-id-1' } } }),
    } as any);

    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });

    await waitFor(() => {
      expect(screen.getByTestId('payment-modal')).toBeInTheDocument();
    });
  };

  it('modal close button redirects to returnUrl', async () => {
    await setupPaymentModal();
    fireEvent.click(screen.getByTestId('payment-close'));
    expect(window.location.href).toContain('commerce.tecosystem.app');
  });

  it('modal success button redirects with txid and payment_id', async () => {
    await setupPaymentModal();
    await act(async () => {
      fireEvent.click(screen.getByTestId('payment-success'));
    });
    expect(window.location.href).toContain('payment_status=success');
    expect(window.location.href).toContain('txid=tx-123');
    expect(window.location.href).toContain('payment_id=pay-456');
  });
});

// ─────────────────────────────────────────────────────────────────
// 10. piPrice carousel auto-advance (setInterval)
// ─────────────────────────────────────────────────────────────────
describe('HubPage — carousel auto-advance', () => {
  it('does NOT start interval when piPrice is null', async () => {
    vi.useFakeTimers();
    mockUseHubData.mockReturnValue({ ...defaultHubData, piPrice: null });
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    // No crash when advancing timers
    act(() => { vi.advanceTimersByTime(6000); });
    expect(screen.getByTestId('hub-carousel')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('carousel auto-advances when piPrice is set', async () => {
    vi.useFakeTimers();
    const piPrice = { price: 1.5, change24h: 0.1, high24h: 2.0, low24h: 1.0 };
    mockUseHubData.mockReturnValue({ ...defaultHubData, piPrice });
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    // After 5s the interval fires
    await act(async () => { vi.advanceTimersByTime(5100); });
    expect(screen.getByTestId('hub-carousel')).toBeInTheDocument();
    vi.useRealTimers();
  });
});

// ─────────────────────────────────────────────────────────────────
// 11. User with PRO subscription (userPro branch)
// ─────────────────────────────────────────────────────────────────
describe('HubPage — PRO user', () => {
  it('renders hub with PRO user correctly', async () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultAuthState,
      user: { ...defaultUser, subscriptionPlan: 'Pro', kycVerified: true },
    });
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    expect(screen.getByTestId('hub-header')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// 12. wsUnread triggers wallet balance refresh
// ─────────────────────────────────────────────────────────────────
describe('HubPage — realtime notifications', () => {
  it('useRealtimeNotifications receives userId and token', async () => {
    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });
    expect(mockUseRealtime).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        token:  'tok-123',
      }),
    );
  });

  it('onWalletUpdate callback triggers refreshBalance (via setTimeout)', async () => {
    vi.useFakeTimers();
    const refreshBalance = vi.fn();
    mockUseHubData.mockReturnValue({ ...defaultHubData, refreshBalance });

    // Simulate useRealtimeNotifications calling onWalletUpdate
    mockUseRealtime.mockImplementation(({ onWalletUpdate }: any) => {
      onWalletUpdate(); // call immediately
      return { unread: 0, connected: false, clearUnread: vi.fn() };
    });

    const HubPage = await getPage();
    await act(async () => { render(<HubPage />); });

    // Advance timer by 500ms
    await act(async () => { vi.advanceTimersByTime(600); });

    expect(refreshBalance).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

// ─────────────────────────────────────────────────────────────────
// 13. Error boundary wraps HubPageInner
// ─────────────────────────────────────────────────────────────────
describe('HubPage — ErrorBoundary wrapper', () => {
  it('renders through ErrorBoundary without error', async () => {
    const HubPage = await getPage();
    const { container } = render(<HubPage />);
    expect(container).toBeTruthy();
  });
});
