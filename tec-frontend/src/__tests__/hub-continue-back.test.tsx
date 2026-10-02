/**
 * Back from an app opened by the grid: the Hub reloads with none of its cookies
 * (C-123 §7). It used to try a silent Pi sign-in, wait out its budget, and leave
 * for the marketing page's "Sign in with Pi" — where one tap worked at once
 * (owner, phone, 2026-10-02). Now it offers that tap on the Hub, straight away.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@/test-utils/render-with-locale';

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

// `@/lib/i18n` is NOT mocked. These files used to stub it with a hand-written `t`
// object holding a handful of keys — so a component reading a key the real
// dictionary does not have still passed. The suite renders through the REAL
// LocaleProvider (see @/test-utils/render-with-locale); a missing or misspelled
// translation key now fails here instead of at runtime.

// ── Stub hub sub-components so we don't need their deps ────────────
// Spread the real module and override only what this file stubs. A hand-listed
// mock silently breaks the moment the barrel gains an export — which is exactly
// how HubTools/HubBottomNav took this file down.
vi.mock('@/components/hub', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/hub')>()),
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
  HubAppsGrid:  ({ apps, onOpenStandalone }: any) => (
    <div data-testid="hub-apps-grid">
      {apps.map((a: any) => (
        <a key={a.slug} data-testid={`tile-${a.slug}`} data-app-url={a.appUrl ?? ''} href={a.href}
          onClick={(e) => { e.preventDefault(); onOpenStandalone?.(a); }}>{a.slug}</a>
      ))}
    </div>
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
  LIVE_DOMAINS:      [
    { slug: 'ecommerce', emoji: '', group: 'commerce', layer: 'app',
      route: 'https://ecommerce.tecosystem.app', name: { en: 'Ecommerce' }, description: { en: 'Shop' } },
    { slug: 'kyc', emoji: '', group: 'hub', layer: 'app',
      route: '/hub/kyc', name: { en: 'KYC' }, description: { en: 'KYC' } },
  ],
  COMING_SOON:       [],
}));

vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: any) => <>{children}</>,
}));



const login = vi.fn();
const signedOut = { user: null, isAuthenticated: false, isLoading: false, signingIn: false, login, logout: vi.fn(), error: null };

const navType = (type: string) =>
  vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{ type } as unknown as PerformanceEntry]);

const setUA = (ua: string) => Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
const PI_UA = 'Mozilla/5.0 (Linux; Android 13; SM-A515F Build/TP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36 PiBrowser/2.0';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  setUA(PI_UA);
  login.mockReset();
  mockUsePiAuth.mockReturnValue(signedOut);
  mockUsePiSdkReady.mockReturnValue({ piReady: false, authReady: false, lastError: null, ensurePiAuth: vi.fn() });
  mockUseHubData.mockReturnValue({
    balance: '0', assetCount: 0, piPrice: null, notifCount: 0, time: '12:00',
    setNotifCount: vi.fn(), refresh: vi.fn().mockResolvedValue(undefined), refreshBalance: vi.fn(),
  });
  mockUseRealtime.mockReturnValue({ unread: 0, connected: false, clearUnread: vi.fn() });
  mockGetStoredUser.mockReturnValue(null);
  mockGetAccessToken.mockReturnValue(null);
  Object.defineProperty(window, 'location', {
    value: { href: '/hub', search: '', replace: vi.fn() }, writable: true, configurable: true,
  });
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({}) } as any);
});

describe('Hub — no session on /hub: the tap, at once, on the Hub', () => {
  it('turns the silent Pi sign-in off, and offers "Continue with Pi" instead of leaving', async () => {
    navType('back_forward');
    const { default: HubPage } = await import('@/app/hub/page');
    await act(async () => { render(<HubPage />); });

    expect(mockUsePiAuth).toHaveBeenCalledWith({ silentOnLoad: false });
    expect(screen.getByText('Continue with Pi')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalledWith('/');
  });

  it('the same for a reload that is not a Back — Pi Browser reloads the Hub from a new tab that way', async () => {
    navType('navigate');
    const { default: HubPage } = await import('@/app/hub/page');
    await act(async () => { render(<HubPage />); });
    expect(mockUsePiAuth).toHaveBeenCalledWith({ silentOnLoad: false });
    expect(screen.getByText('Continue with Pi')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalledWith('/');
  });

  it('the tap signs in with Pi', async () => {
    login.mockResolvedValue({ success: true });
    const { default: HubPage } = await import('@/app/hub/page');
    await act(async () => { render(<HubPage />); });
    await act(async () => { fireEvent.click(screen.getByText('Continue with Pi')); });
    expect(login).toHaveBeenCalledTimes(1);
  });

  it('says so when Pi does not answer the tap, and keeps the button', async () => {
    login.mockRejectedValue(new Error('timed out'));
    const { default: HubPage } = await import('@/app/hub/page');
    await act(async () => { render(<HubPage />); });
    await act(async () => { fireEvent.click(screen.getByText('Continue with Pi')); });
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('Continue with Pi')).toBeInTheDocument();
  });

  it('a desktop browser keeps the old way — to the sign-in page, where it can at least be told to open Pi Browser', async () => {
    setUA(DESKTOP_UA);
    const { default: HubPage } = await import('@/app/hub/page');
    await act(async () => { render(<HubPage />); });
    expect(mockUsePiAuth).toHaveBeenCalledWith({ silentOnLoad: true });
    expect(screen.queryByText('Continue with Pi')).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('recognises Pi Browser by its WebView marker even without a Pi token in the agent', async () => {
    setUA('Mozilla/5.0 (Linux; Android 13; SM-A515F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36');
    const { default: HubPage } = await import('@/app/hub/page');
    await act(async () => { render(<HubPage />); });
    expect(screen.getByText('Continue with Pi')).toBeInTheDocument();
  });

  it('the Mode-1 pay screen keeps its silent sign-in — its payment preparation waits on it', async () => {
    Object.defineProperty(window, 'location', {
      value: { href: '/hub?pay=1&amount=5', search: '?pay=1&amount=5', replace: vi.fn() },
      writable: true, configurable: true,
    });
    const { default: HubPage } = await import('@/app/hub/page');
    await act(async () => { render(<HubPage />); });
    expect(mockUsePiAuth).toHaveBeenCalledWith({ silentOnLoad: true });
  });
});
