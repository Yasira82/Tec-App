/**
 * The Hub page signs every external app's link while the visitor is here, and
 * the grid opens it standalone (C-123 §12; KB audits/HUB_GRID_VISITS_NOT_COUNTED_2026-09-29.md).
 * Mocks follow hub-page-extended.test.tsx; the registry holds one external app
 * and one Hub route.
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


const SIGNED = 'https://ecommerce.tecosystem.app/api/auth/sso-callback?token=signed&redirect=%2F';

beforeEach(() => {
  vi.clearAllMocks();
  mockUsePiAuth.mockReturnValue({
    user: { id: 'u1', piUsername: 'alice', subscriptionPlan: 'Free', kycVerified: false },
    isAuthenticated: true, isLoading: false, login: vi.fn(), logout: vi.fn(), error: null,
  });
  mockUsePiSdkReady.mockReturnValue({ piReady: false, authReady: false, lastError: null, ensurePiAuth: vi.fn() });
  mockUseHubData.mockReturnValue({
    balance: '0', assetCount: 0, piPrice: null, notifCount: 0, time: '12:00',
    setNotifCount: vi.fn(), refresh: vi.fn().mockResolvedValue(undefined), refreshBalance: vi.fn(),
  });
  mockUseRealtime.mockReturnValue({ unread: 0, connected: false, clearUnread: vi.fn() });
  mockGetStoredUser.mockReturnValue({ id: 'u1', piUsername: 'alice' });
  mockGetAccessToken.mockReturnValue('tok');
  Object.defineProperty(window, 'location', {
    value: { href: '/', search: '', replace: vi.fn() }, writable: true, configurable: true,
  });
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init?: any) => {
    if (String(url).includes('/api/auth/sso-links')) {
      const { targets } = JSON.parse(String(init?.body)) as { targets: string[] };
      return { ok: true, json: async () => ({ links: Object.fromEntries(targets.map((t) => [t, SIGNED])) }) } as any;
    }
    return { ok: true, json: async () => ({}) } as any;
  });
});

const ssoLinkCalls = () => (globalThis.fetch as any).mock.calls
  .filter((c: unknown[]) => String(c[0]).includes('/api/auth/sso-links'));

describe('Hub grid — apps open standalone (owner decision, 2026-10-02)', () => {
  it('asks the Hub to sign each external app, and hands the grid the signed link', async () => {
    const { default: HubPage } = await import('@/app/hub/page');
    await act(async () => { render(<HubPage />); });
    await waitFor(() => expect(screen.getByTestId('tile-ecommerce').getAttribute('href')).toBe(SIGNED));

    const body = JSON.parse(String(ssoLinkCalls()[0][1].body));
    expect(body.targets).toEqual(['https://ecommerce.tecosystem.app']);   // Hub routes are not signed
    expect(screen.getByTestId('tile-ecommerce').getAttribute('data-app-url')).toBe('https://ecommerce.tecosystem.app');
  });

  it('never routes a tile through /api/auth/sso — that is what made every visit the Hub\'s', async () => {
    const { default: HubPage } = await import('@/app/hub/page');
    await act(async () => { render(<HubPage />); });
    for (const a of screen.getByTestId('hub-apps-grid').querySelectorAll('a')) {
      expect(a.getAttribute('href')).not.toContain('/api/auth/sso?target=');
    }
    expect(screen.getByTestId('tile-kyc').getAttribute('href')).toBe('/hub/kyc');
  });

  it('a tap leaves a return mark for the Hub to find on the way back', async () => {
    sessionStorage.clear();
    const { default: HubPage } = await import('@/app/hub/page');
    await act(async () => { render(<HubPage />); });
    fireEvent.click(screen.getByTestId('tile-ecommerce'));
    expect(Number(sessionStorage.getItem('tec_hub_left_for_app'))).toBeGreaterThan(0);
    sessionStorage.clear();
  });

  it('a tap marks the token spent and fetches a fresh set afterwards', async () => {
    const { default: HubPage } = await import('@/app/hub/page');
    await act(async () => { render(<HubPage />); });
    await waitFor(() => expect(ssoLinkCalls().length).toBeGreaterThanOrEqual(1));
    // Counted from the tap: a refresh scheduled by an earlier test's tap can land here.
    const before = ssoLinkCalls().length;
    fireEvent.click(screen.getByTestId('tile-ecommerce'));
    await waitFor(() => expect(ssoLinkCalls().length).toBeGreaterThan(before), { timeout: 3000 });
  });

  it('signs nothing for a signed-out visitor', async () => {
    mockUsePiAuth.mockReturnValue({ user: null, isAuthenticated: false, isLoading: false, login: vi.fn(), logout: vi.fn(), error: null });
    const { default: HubPage } = await import('@/app/hub/page');
    await act(async () => { render(<HubPage />); });
    expect(ssoLinkCalls().length).toBe(0);
  });
});
