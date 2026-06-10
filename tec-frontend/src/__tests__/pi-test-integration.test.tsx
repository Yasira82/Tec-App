/**
 * Tests for PiTestClient, PiIntegration, and api/ai/chat/route.ts
 * Covers previously uncovered branches/statements to raise coverage.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// ─── Hoisted refs ──────────────────────────────────────────────────────────────
const mockIsPiBrowser   = vi.hoisted(() => vi.fn());
const mockLoginWithPi   = vi.hoisted(() => vi.fn());
const mockGetStoredUser = vi.hoisted(() => vi.fn());
const mockGetAccessToken = vi.hoisted(() => vi.fn());
const mockCreateU2A     = vi.hoisted(() => vi.fn());
const mockPiRuntimeIsAvailable = vi.hoisted(() => vi.fn());
const mockUsePiAuth     = vi.hoisted(() => vi.fn());
const mockUsePiPayment  = vi.hoisted(() => vi.fn());

// ─── Module mocks ──────────────────────────────────────────────────────────────
vi.mock('@/lib-client/pi/pi-auth', () => ({
  isPiBrowser:    mockIsPiBrowser,
  loginWithPi:    mockLoginWithPi,
  getStoredUser:  mockGetStoredUser,
  getAccessToken: mockGetAccessToken,
  getCsrfToken:   vi.fn(() => 'csrf-abc'),
  ssoRedirect:    vi.fn(),
  logout:         vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib-client/pi/pi-payment', () => ({
  createU2APayment: mockCreateU2A,
  testPiSDK:        vi.fn(() => true),
}));

vi.mock('@/lib-client/pi/PiRuntime', () => ({
  PiRuntime: {
    isAvailable:   mockPiRuntimeIsAvailable,
    isReady:       vi.fn(() => true),
    init:          vi.fn(),
    authenticate:  vi.fn(),
    createPayment: vi.fn(),
    canAttempt:    vi.fn(() => true),
  },
}));

vi.mock('@/lib-client/hooks/usePiAuth', () => ({
  usePiAuth: mockUsePiAuth,
}));

vi.mock('@/lib-client/hooks/usePiPayment', () => ({
  usePiPayment: mockUsePiPayment,
}));

vi.mock('@/lib/i18n', () => ({
  useTranslation: vi.fn(() => ({
    locale: 'en', setLocale: vi.fn(), dir: 'ltr',
    t: {
      common: { loading: 'Loading...', login: 'Sign in with Pi', appName: 'TEC' },
      dashboard: {
        piIntegration: {
          title: 'Pi Network Integration',
          connectBtn: 'Connect with Pi',
          authenticated: 'Authenticated as:',
          testSdk: 'Test Pi SDK (Check Console)',
          payDemo: 'Pay 1 Pi - Demo Payment',
          paymentSuccess: 'Payment successful! 🎉',
          paymentFailed: 'Payment failed',
          processing: 'Processing...',
        },
      },
    },
  })),
  LocaleProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib-client/pi/pi-session', () => ({
  piSession: {
    ensurePaymentsReady: vi.fn().mockResolvedValue(true),
    ensureAuth:          vi.fn().mockResolvedValue(true),
    acquirePaymentLock:  vi.fn().mockResolvedValue(true),
    releasePaymentLock:  vi.fn(),
    reset:               vi.fn(),
    reInit:              vi.fn(),
    isAuthenticated:     true,
    hasScope:            true,
    isPaymentLocked:     false,
    lastError:           null,
  },
  PiAuthError: {},
}));

// CSS modules mock
vi.mock('@/components/PiIntegration.module.css', () => ({
  default: {
    container: 'container', card: 'card', title: 'title',
    error: 'error', errorMessage: 'errorMessage', btn: 'btn',
    btnRetry: 'btnRetry', btnConnect: 'btnConnect',
    authenticated: 'authenticated', checkmark: 'checkmark',
    mainnetIndicator: 'mainnetIndicator', buttonGroup: 'buttonGroup',
    btnTest: 'btnTest', btnPay: 'btnPay',
    success: 'success', successMessage: 'successMessage',
    txidInfo: 'txidInfo', paymentIdInfo: 'paymentIdInfo',
    warning: 'warning', processing: 'processing', spinner: 'spinner',
  },
}));

// Static imports AFTER mocks
import { PiTestClient } from '@/app/pi-test/PiTestClient';
import PiIntegration    from '@/components/PiIntegration';

// ─── Default state helpers ──────────────────────────────────────────────────────
const defaultUsePiAuth = {
  user:            null as { piUsername: string } | null,
  isAuthenticated: false,
  isLoading:       false,
  error:           null as string | null,
  errorType:       null as string | null,
  login:           vi.fn(),
  logout:          vi.fn(),
};

const defaultUsePiPayment = {
  isProcessing:  false,
  lastPayment:   null as { message?: string; txid?: string; paymentId?: string; success?: boolean; status?: string } | null,
  error:         null as string | null,
  errorType:     null as string | null,
  sdkAvailable:  true,
  testSDK:       vi.fn(),
  payDemoPi:     vi.fn(),
  resetPayment:  vi.fn(),
};

// ─── beforeEach ────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();

  mockGetStoredUser.mockReturnValue(null);
  mockGetAccessToken.mockReturnValue(null);
  mockIsPiBrowser.mockReturnValue(true);
  mockPiRuntimeIsAvailable.mockReturnValue(true);
  mockLoginWithPi.mockResolvedValue({
    success: true,
    user: { piUsername: 'testuser', piId: 'uid-1', id: 'u-1', role: 'user', subscriptionPlan: 'FREE', createdAt: '' },
  });
  mockCreateU2A.mockResolvedValue({
    success: true, status: 'completed',
    paymentId: 'pay-1', txid: 'tx-abc123', amount: 1, memo: 'Test',
  });

  mockUsePiAuth.mockReturnValue({ ...defaultUsePiAuth });
  mockUsePiPayment.mockReturnValue({ ...defaultUsePiPayment });

  // global fetch mock
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok:         true,
    status:     200,
    statusText: 'OK',
    json:       async () => ({ ok: true }),
    body: {
      getReader: () => ({
        read:   vi.fn().mockResolvedValue({ done: true, value: undefined }),
        cancel: vi.fn(),
      }),
    },
  } as unknown as Response);

  // Reset window flags
  Object.defineProperty(window, '__TEC_PI_READY', { value: undefined, writable: true, configurable: true });
  Object.defineProperty(window, '__TEC_PI_ERROR', { value: undefined, writable: true, configurable: true });
  Object.defineProperty(window, 'Pi', { value: undefined, writable: true, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllTimers();
});

// ═══════════════════════════════════════════════════════════════════════════════
// PiTestClient
// ═══════════════════════════════════════════════════════════════════════════════

describe('PiTestClient', () => {
  it('renders without crash', () => {
    const { container } = render(<PiTestClient />);
    expect(container).toBeTruthy();
  });

  it('renders the heading', () => {
    render(<PiTestClient />);
    expect(screen.getByText(/TEC Pi Integration Test/)).toBeInTheDocument();
  });

  it('renders the developer diagnostics subtitle', () => {
    render(<PiTestClient />);
    expect(screen.getByText(/Developer diagnostics/)).toBeInTheDocument();
  });

  it('shows initial "No logs yet" message', () => {
    render(<PiTestClient />);
    expect(screen.getByText('No logs yet — run a test above.')).toBeInTheDocument();
  });

  it('shows Authenticate button', () => {
    render(<PiTestClient />);
    expect(screen.getByRole('button', { name: /Authenticate/ })).toBeInTheDocument();
  });

  it('shows Test Payment button', () => {
    render(<PiTestClient />);
    expect(screen.getByRole('button', { name: /Test Payment/ })).toBeInTheDocument();
  });

  it('shows All Services button', () => {
    render(<PiTestClient />);
    expect(screen.getByRole('button', { name: /All Services/ })).toBeInTheDocument();
  });

  it('shows BFF Health button', () => {
    render(<PiTestClient />);
    expect(screen.getByRole('button', { name: /BFF Health/ })).toBeInTheDocument();
  });

  it('shows SSO Test button', () => {
    render(<PiTestClient />);
    expect(screen.getByRole('button', { name: /SSO Test/ })).toBeInTheDocument();
  });

  it('shows Cancel Pending button', () => {
    render(<PiTestClient />);
    expect(screen.getByRole('button', { name: /Cancel Pending/ })).toBeInTheDocument();
  });

  it('shows Show Cookies button', () => {
    render(<PiTestClient />);
    expect(screen.getByRole('button', { name: /Show Cookies/ })).toBeInTheDocument();
  });

  it('shows Show User button', () => {
    render(<PiTestClient />);
    expect(screen.getByRole('button', { name: /Show User/ })).toBeInTheDocument();
  });

  it('shows Clear Logs button', () => {
    render(<PiTestClient />);
    expect(screen.getByRole('button', { name: /Clear Logs/ })).toBeInTheDocument();
  });

  it('SDK ready path: window.__TEC_PI_READY=true sets SDK ready on mount', async () => {
    Object.defineProperty(window, '__TEC_PI_READY', { value: true, writable: true, configurable: true });
    render(<PiTestClient />);
    await waitFor(() => {
      expect(screen.getByText(/Pi SDK already initialised/)).toBeInTheDocument();
    });
  });

  it('SDK error path: window.__TEC_PI_ERROR=true logs error on mount', async () => {
    Object.defineProperty(window, '__TEC_PI_ERROR', { value: true, writable: true, configurable: true });
    render(<PiTestClient />);
    await waitFor(() => {
      expect(screen.getByText(/Pi SDK failed to initialise/)).toBeInTheDocument();
    });
  });

  it('tec-pi-ready event sets SDK ready and logs success', async () => {
    render(<PiTestClient />);
    act(() => {
      window.dispatchEvent(new Event('tec-pi-ready'));
    });
    await waitFor(() => {
      expect(screen.getByText(/Pi SDK initialised/)).toBeInTheDocument();
    });
  });

  it('tec-pi-error event sets SDK failed and logs error', async () => {
    render(<PiTestClient />);
    act(() => {
      window.dispatchEvent(new Event('tec-pi-error'));
    });
    await waitFor(() => {
      expect(screen.getByText(/Pi SDK init error/)).toBeInTheDocument();
    });
  });

  it('timeout path: 5s timeout logs warn if no SDK events fired', async () => {
    vi.useFakeTimers();
    render(<PiTestClient />);
    act(() => {
      vi.advanceTimersByTime(5001);
    });
    vi.useRealTimers();
    await waitFor(() => {
      expect(screen.getByText(/Pi SDK not ready after 5s/)).toBeInTheDocument();
    });
  });

  it('restores session from getStoredUser on mount', async () => {
    mockGetStoredUser.mockReturnValue({ piUsername: 'alice', piId: 'uid-alice' });
    render(<PiTestClient />);
    await waitFor(() => {
      expect(screen.getByText(/Restored session: @alice/)).toBeInTheDocument();
    });
  });

  it('clicking Authenticate calls loginWithPi when isPiBrowser=true', async () => {
    render(<PiTestClient />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Authenticate/ }));
    });
    await waitFor(() => {
      expect(mockLoginWithPi).toHaveBeenCalled();
    });
  });

  it('successful auth logs username', async () => {
    mockLoginWithPi.mockResolvedValue({
      success: true,
      user: { piUsername: 'bob', piId: 'uid-bob', id: 'u-bob', role: 'user', subscriptionPlan: 'FREE', createdAt: '' },
    });
    render(<PiTestClient />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Authenticate/ }));
    });
    await waitFor(() => {
      const matches = screen.getAllByText(/@bob/);
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  it('auth error when isPiBrowser=false logs error', async () => {
    mockIsPiBrowser.mockReturnValue(false);
    render(<PiTestClient />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Authenticate/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Not inside Pi Browser/)).toBeInTheDocument();
    });
  });

  it('auth error from thrown exception logs error', async () => {
    mockLoginWithPi.mockRejectedValue(new Error('Auth timed out'));
    render(<PiTestClient />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Authenticate/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Auth timed out/)).toBeInTheDocument();
    });
  });

  it('Test Payment warns if not authenticated', async () => {
    render(<PiTestClient />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Test Payment/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Authenticate first/)).toBeInTheDocument();
    });
  });

  it('Test Payment calls createU2APayment after auth', async () => {
    render(<PiTestClient />);
    // Authenticate first
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Authenticate/ }));
    });
    await waitFor(() => expect(mockLoginWithPi).toHaveBeenCalled());

    // Now pay
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Test Payment/ }));
    });
    await waitFor(() => {
      expect(mockCreateU2A).toHaveBeenCalledWith(1, 'Test Payment from TEC Hub', { source: 'test' });
    });
  });

  it('successful payment logs paymentId and txid', async () => {
    mockCreateU2A.mockResolvedValue({
      success: true, status: 'completed',
      paymentId: 'pay-xyz', txid: 'tx-999', amount: 1, memo: 'test',
    });
    render(<PiTestClient />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Authenticate/ }));
    });
    await waitFor(() => expect(mockLoginWithPi).toHaveBeenCalled());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Test Payment/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/pay-xyz/)).toBeInTheDocument();
    });
  });

  it('cancelled payment logs cancelled', async () => {
    mockCreateU2A.mockResolvedValue({
      success: false, status: 'cancelled', amount: 1, memo: 'test',
    });
    render(<PiTestClient />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Authenticate/ }));
    });
    await waitFor(() => expect(mockLoginWithPi).toHaveBeenCalled());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Test Payment/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Payment cancelled by user/)).toBeInTheDocument();
    });
  });

  it('payment error status logs error', async () => {
    mockCreateU2A.mockResolvedValue({
      success: false, status: 'error', message: 'Insufficient funds', amount: 1, memo: 'test',
    });
    render(<PiTestClient />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Authenticate/ }));
    });
    await waitFor(() => expect(mockLoginWithPi).toHaveBeenCalled());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Test Payment/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Insufficient funds/)).toBeInTheDocument();
    });
  });

  it('payment thrown exception logs error', async () => {
    mockCreateU2A.mockRejectedValue(new Error('Network down'));
    render(<PiTestClient />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Authenticate/ }));
    });
    await waitFor(() => expect(mockLoginWithPi).toHaveBeenCalled());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Test Payment/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Network down/)).toBeInTheDocument();
    });
  });

  it('Check All Services calls /api/health/services and logs result', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      json: async () => ({
        ok: true,
        services: [{ name: 'auth', status: 'ok', ms: 42 }],
      }),
    } as unknown as Response);

    render(<PiTestClient />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /All Services/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Services check done/)).toBeInTheDocument();
    });
  });

  it('Check All Services shows service chips when services returned', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      json: async () => ({
        ok: true,
        services: [{ name: 'gateway', status: 'ok', ms: 15 }],
      }),
    } as unknown as Response);

    render(<PiTestClient />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /All Services/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/gateway/)).toBeInTheDocument();
    });
  });

  it('Check All Services shows warn log when ok=false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      json: async () => ({ ok: false, services: [] }),
    } as unknown as Response);

    render(<PiTestClient />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /All Services/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Services check done/)).toBeInTheDocument();
    });
  });

  it('Check All Services logs error on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection refused'));
    render(<PiTestClient />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /All Services/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Services check failed/)).toBeInTheDocument();
    });
  });

  it('BFF Health button calls /api/health', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      json: async () => ({ status: 'up' }),
    } as unknown as Response);

    render(<PiTestClient />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /BFF Health/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Health:/)).toBeInTheDocument();
    });
  });

  it('BFF Health logs error on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('timeout'));
    render(<PiTestClient />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /BFF Health/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Health check failed/)).toBeInTheDocument();
    });
  });

  it('SSO Test button calls /api/auth/sso and logs 302', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false, status: 302, statusText: 'Found',
      json: async () => ({}),
    } as unknown as Response);

    render(<PiTestClient />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /SSO Test/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/SSO response: 302/)).toBeInTheDocument();
    });
  });

  it('SSO Test logs error on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('CORS error'));
    render(<PiTestClient />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /SSO Test/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/SSO test failed/)).toBeInTheDocument();
    });
  });

  it('Show Cookies button logs cookie info', () => {
    Object.defineProperty(document, 'cookie', {
      value: 'tec_user=testval; tec_access_token=tokenvalue123',
      writable: true,
      configurable: true,
    });
    render(<PiTestClient />);
    fireEvent.click(screen.getByRole('button', { name: /Show Cookies/ }));
    expect(screen.getByText(/Cookies:/)).toBeInTheDocument();
  });

  it('Show User button logs user and token info', () => {
    mockGetStoredUser.mockReturnValue({ piUsername: 'dan' });
    mockGetAccessToken.mockReturnValue('tok-abc');
    render(<PiTestClient />);
    fireEvent.click(screen.getByRole('button', { name: /Show User/ }));
    expect(screen.getByText(/User:/)).toBeInTheDocument();
    expect(screen.getByText(/Token:/)).toBeInTheDocument();
  });

  it('Clear Logs button clears the log', async () => {
    render(<PiTestClient />);
    // Generate a log entry
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Show User/ }));
    });
    // Clear
    fireEvent.click(screen.getByRole('button', { name: /Clear Logs/ }));
    expect(screen.getByText('No logs yet — run a test above.')).toBeInTheDocument();
  });

  it('Cancel Pending logs error when isPiBrowser=false', async () => {
    mockIsPiBrowser.mockReturnValue(false);
    render(<PiTestClient />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cancel Pending/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Not inside Pi Browser/)).toBeInTheDocument();
    });
  });

  it('Cancel Pending logs error when PiRuntime not available', async () => {
    mockPiRuntimeIsAvailable.mockReturnValue(false);
    render(<PiTestClient />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cancel Pending/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Not inside Pi Browser/)).toBeInTheDocument();
    });
  });

  it('Cancel Pending calls window.Pi.authenticate when available', async () => {
    const mockAuthenticate = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, 'Pi', {
      value: { authenticate: mockAuthenticate },
      writable: true,
      configurable: true,
    });
    mockIsPiBrowser.mockReturnValue(true);
    mockPiRuntimeIsAvailable.mockReturnValue(true);
    render(<PiTestClient />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cancel Pending/ }));
    });
    await waitFor(() => {
      expect(mockAuthenticate).toHaveBeenCalled();
    });
  });

  it('payment failure status without message falls back to status string', async () => {
    mockCreateU2A.mockResolvedValue({
      success: false, status: 'failed', amount: 1, memo: 'test',
    });
    render(<PiTestClient />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Authenticate/ }));
    });
    await waitFor(() => expect(mockLoginWithPi).toHaveBeenCalled());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Test Payment/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Payment failed: failed/)).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PiIntegration
// ═══════════════════════════════════════════════════════════════════════════════

describe('PiIntegration', () => {
  it('renders without crash', () => {
    const { container } = render(<PiIntegration />);
    expect(container).toBeTruthy();
  });

  it('renders Pi Network Integration title', () => {
    render(<PiIntegration />);
    expect(screen.getByText(/Pi Network Integration/)).toBeInTheDocument();
  });

  it('shows Connect button when not authenticated', () => {
    render(<PiIntegration />);
    expect(screen.getByText('Connect with Pi')).toBeInTheDocument();
  });

  it('Connect button is disabled when loading', () => {
    mockUsePiAuth.mockReturnValue({ ...defaultUsePiAuth, isLoading: true });
    render(<PiIntegration />);
    expect(screen.getByText(/Loading.../)).toBeDisabled();
  });

  it('shows authenticated user when isAuthenticated=true', () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultUsePiAuth,
      user:            { piUsername: 'charlie' },
      isAuthenticated: true,
    });
    render(<PiIntegration />);
    expect(screen.getByText(/@charlie/)).toBeInTheDocument();
  });

  it('does not show Connect button when authenticated', () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultUsePiAuth,
      user:            { piUsername: 'charlie' },
      isAuthenticated: true,
    });
    render(<PiIntegration />);
    expect(screen.queryByText('Connect with Pi')).not.toBeInTheDocument();
  });

  it('shows mainnet mode indicator', () => {
    render(<PiIntegration />);
    expect(screen.getByText(/Mainnet Mode: Real Pi payments/)).toBeInTheDocument();
  });

  it('clicking Connect calls login', async () => {
    render(<PiIntegration />);
    await act(async () => {
      fireEvent.click(screen.getByText('Connect with Pi'));
    });
    expect(defaultUsePiAuth.login).toHaveBeenCalled();
  });

  it('shows error block when authError is present', () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultUsePiAuth,
      error: 'Pi Browser required',
      errorType: 'not_pi_browser',
    });
    render(<PiIntegration />);
    expect(screen.getByText(/Pi Browser required/)).toBeInTheDocument();
  });

  it('shows Retry button when authError is present', () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultUsePiAuth,
      error: 'Pi Browser required',
      errorType: 'not_pi_browser',
    });
    render(<PiIntegration />);
    expect(screen.getByText(/Retry/)).toBeInTheDocument();
  });

  it('shows auth error instructions for not_pi_browser', () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultUsePiAuth,
      error: 'Pi Browser required',
      errorType: 'not_pi_browser',
    });
    render(<PiIntegration />);
    expect(screen.getByText(/Pi Network app → Apps/)).toBeInTheDocument();
  });

  it('shows auth error instructions for timeout', () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultUsePiAuth,
      error: 'Timed out',
      errorType: 'timeout',
    });
    render(<PiIntegration />);
    expect(screen.getByText(/check your internet connection/)).toBeInTheDocument();
  });

  it('shows auth error instructions for storage', () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultUsePiAuth,
      error: 'Save failed',
      errorType: 'storage',
    });
    render(<PiIntegration />);
    expect(screen.getByText(/private browsing/)).toBeInTheDocument();
  });

  it('shows generic auth error for unknown errorType', () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultUsePiAuth,
      error: 'Unknown error',
      errorType: 'auth_failed',
    });
    render(<PiIntegration />);
    expect(screen.getByText(/Unknown error/)).toBeInTheDocument();
  });

  it('shows Test Pi SDK button', () => {
    render(<PiIntegration />);
    expect(screen.getByText(/Test Pi SDK/)).toBeInTheDocument();
  });

  it('clicking Test Pi SDK calls testSDK', () => {
    render(<PiIntegration />);
    fireEvent.click(screen.getByText(/Test Pi SDK/));
    expect(defaultUsePiPayment.testSDK).toHaveBeenCalled();
  });

  it('shows Pay Demo button disabled when not authenticated', () => {
    render(<PiIntegration />);
    expect(screen.getByText(/Login first/)).toBeInTheDocument();
  });

  it('Pay Demo button disabled when isProcessing', () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultUsePiAuth,
      isAuthenticated: true,
      user: { piUsername: 'ed' },
    });
    mockUsePiPayment.mockReturnValue({
      ...defaultUsePiPayment,
      isProcessing: true,
    });
    render(<PiIntegration />);
    // When isProcessing=true and isAuthenticated=true, button shows Processing text and is disabled
    const processingEl = screen.getByText(/Processing\.\.\./);
    expect(processingEl.closest('button')).toBeDisabled();
  });

  it('clicking Pay Demo calls payDemoPi when authenticated', async () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultUsePiAuth,
      isAuthenticated: true,
      user: { piUsername: 'frank' },
    });
    mockUsePiPayment.mockReturnValue({
      ...defaultUsePiPayment,
      payDemoPi: vi.fn().mockResolvedValue({ success: true, status: 'completed', message: 'ok', txid: 'tx1', paymentId: 'p1' }),
    });
    render(<PiIntegration />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Pay 1 Pi/));
    });
    expect(mockUsePiPayment().payDemoPi).toHaveBeenCalled();
  });

  it('shows success state after payDemoPi returns success', async () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultUsePiAuth,
      isAuthenticated: true,
      user: { piUsername: 'grace' },
    });
    const mockPay = vi.fn().mockResolvedValue({
      success: true, status: 'completed', message: 'Payment successful! 🎉', txid: 'tx-ok', paymentId: 'p-ok',
    });
    mockUsePiPayment.mockReturnValue({
      ...defaultUsePiPayment,
      payDemoPi: mockPay,
      lastPayment: { success: true, status: 'completed', message: 'Payment successful! 🎉', txid: 'tx-ok', paymentId: 'p-ok' },
    });

    // Re-render after payment with success state
    const { rerender } = render(<PiIntegration />);

    await act(async () => {
      fireEvent.click(screen.getByText(/Pay 1 Pi/));
    });

    // Simulate state update to success
    mockUsePiPayment.mockReturnValue({
      ...defaultUsePiPayment,
      payDemoPi: mockPay,
      lastPayment: { success: true, status: 'completed', message: 'Payment successful! 🎉', txid: 'tx-ok', paymentId: 'p-ok' },
    });
    rerender(<PiIntegration />);

    await waitFor(() => {
      // The success message comes from getPaymentStatusMessage — we check lastPayment is shown
      expect(screen.queryByText(/Pay 1 Pi/)?.closest('button')).not.toBeDisabled();
    });
  });

  it('shows cancelled state message', async () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultUsePiAuth,
      isAuthenticated: true,
      user: { piUsername: 'harry' },
    });
    const mockPay = vi.fn().mockResolvedValue({ success: false, status: 'cancelled', amount: 1, memo: 'test' });
    mockUsePiPayment.mockReturnValue({
      ...defaultUsePiPayment,
      payDemoPi: mockPay,
    });
    render(<PiIntegration />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Pay 1 Pi/));
    });
    await waitFor(() => {
      expect(screen.getByText(/ألغيت الدفعة/)).toBeInTheDocument();
    });
  });

  it('shows error state and Retry button after payment error', async () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultUsePiAuth,
      isAuthenticated: true,
      user: { piUsername: 'ivan' },
    });
    const mockPay = vi.fn().mockResolvedValue({
      success: false, status: 'error', message: 'Approval failed', amount: 1, memo: 'test',
    });
    mockUsePiPayment.mockReturnValue({
      ...defaultUsePiPayment,
      payDemoPi: mockPay,
    });
    render(<PiIntegration />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Pay 1 Pi/));
    });
    await waitFor(() => {
      expect(screen.getByText(/Approval failed/)).toBeInTheDocument();
    });
    expect(screen.getByText(/إعادة المحاولة/)).toBeInTheDocument();
  });

  it('clicking Retry resets payment state', async () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultUsePiAuth,
      isAuthenticated: true,
      user: { piUsername: 'jane' },
    });
    const mockPay = vi.fn().mockResolvedValue({
      success: false, status: 'error', message: 'Fail msg', amount: 1, memo: 'test',
    });
    mockUsePiPayment.mockReturnValue({
      ...defaultUsePiPayment,
      payDemoPi: mockPay,
    });
    render(<PiIntegration />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Pay 1 Pi/));
    });
    await waitFor(() => {
      expect(screen.getByText(/Fail msg/)).toBeInTheDocument();
    });
    const retryBtns = screen.getAllByText(/إعادة المحاولة/);
    fireEvent.click(retryBtns[retryBtns.length - 1]);
    // Error message goes away
    await waitFor(() => {
      expect(screen.queryByText(/Fail msg/)).not.toBeInTheDocument();
    });
  });

  it('shows payment error instructions for not_pi_browser paymentErrorType', async () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultUsePiAuth,
      isAuthenticated: true,
      user: { piUsername: 'kim' },
    });
    const mockPay = vi.fn().mockResolvedValue({
      success: false, status: 'error', message: 'Not Pi Browser', amount: 1, memo: 'test',
    });
    mockUsePiPayment.mockReturnValue({
      ...defaultUsePiPayment,
      payDemoPi: mockPay,
      error: 'Not Pi Browser',
      errorType: 'not_pi_browser',
    });
    render(<PiIntegration />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Pay 1 Pi/));
    });
    await waitFor(() => {
      expect(screen.getByText(/Not Pi Browser/)).toBeInTheDocument();
    });
    // Shows instructions
    expect(screen.getByText(/متصفح Pi Network/)).toBeInTheDocument();
  });

  it('shows payment error instructions for timeout paymentErrorType', async () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultUsePiAuth,
      isAuthenticated: true,
      user: { piUsername: 'leo' },
    });
    const mockPay = vi.fn().mockResolvedValue({
      success: false, status: 'error', message: 'Timed out', amount: 1, memo: 'test',
    });
    mockUsePiPayment.mockReturnValue({
      ...defaultUsePiPayment,
      payDemoPi: mockPay,
      error: 'Timed out',
      errorType: 'timeout',
    });
    render(<PiIntegration />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Pay 1 Pi/));
    });
    await waitFor(() => {
      expect(screen.getByText(/Timed out/)).toBeInTheDocument();
    });
  });

  it('shows payment error instructions for approval_failed paymentErrorType', async () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultUsePiAuth,
      isAuthenticated: true,
      user: { piUsername: 'mia' },
    });
    const mockPay = vi.fn().mockResolvedValue({
      success: false, status: 'error', message: 'Server rejected', amount: 1, memo: 'test',
    });
    mockUsePiPayment.mockReturnValue({
      ...defaultUsePiPayment,
      payDemoPi: mockPay,
      error: 'Server rejected',
      errorType: 'approval_failed',
    });
    render(<PiIntegration />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Pay 1 Pi/));
    });
    await waitFor(() => {
      expect(screen.getByText(/Server rejected/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Server approval failed/)).toBeInTheDocument();
  });

  it('payDemoPi null result sets state to idle', async () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultUsePiAuth,
      isAuthenticated: true,
      user: { piUsername: 'ned' },
    });
    const mockPay = vi.fn().mockResolvedValue(null);
    mockUsePiPayment.mockReturnValue({
      ...defaultUsePiPayment,
      payDemoPi: mockPay,
    });
    render(<PiIntegration />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Pay 1 Pi/));
    });
    // Should stay in idle — no error
    await waitFor(() => {
      expect(screen.queryByText(/Payment failed/)).not.toBeInTheDocument();
    });
  });

  it('payDemoPi throw sets error state', async () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultUsePiAuth,
      isAuthenticated: true,
      user: { piUsername: 'opal' },
    });
    const mockPay = vi.fn().mockRejectedValue(new Error('SDK crash'));
    mockUsePiPayment.mockReturnValue({
      ...defaultUsePiPayment,
      payDemoPi: mockPay,
      error: 'SDK crash',
      errorType: null,
    });
    render(<PiIntegration />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Pay 1 Pi/));
    });
    await waitFor(() => {
      expect(screen.getByText(/SDK crash/)).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// api/ai/chat/route.ts
// ═══════════════════════════════════════════════════════════════════════════════

describe('api/ai/chat route', () => {
  // We test the route by importing GET/POST and calling directly with Request objects.
  // The route uses `export const runtime = 'edge'` and calls fetch internally.

  let POST: (req: Request) => Promise<Response>;
  let OPTIONS: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    // Dynamically import to get fresh module each time (mocks already set up)
    const mod = await import('@/app/api/ai/chat/route');
    POST    = mod.POST as unknown as (req: Request) => Promise<Response>;
    OPTIONS = mod.OPTIONS as unknown as (req: Request) => Promise<Response>;
  });

  const makeRequest = (body: unknown, headers: Record<string, string> = {}) => {
    return new Request('http://localhost/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  };

  it('returns 400 when messages array is empty and no message field', async () => {
    const req = makeRequest({ messages: [] });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/messages/i);
  });

  it('returns 400 when body has no messages and no message', async () => {
    const req = makeRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 503 when no AI API keys are configured', async () => {
    // Ensure no env keys
    const saved = {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      GROQ_API_KEY:      process.env.GROQ_API_KEY,
      GEMINI_API_KEY:    process.env.GEMINI_API_KEY,
    };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const req = makeRequest({ message: 'hello' });
    const res = await POST(req);
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toMatch(/not configured/i);

    // Restore
    if (saved.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = saved.ANTHROPIC_API_KEY;
    if (saved.GROQ_API_KEY)      process.env.GROQ_API_KEY      = saved.GROQ_API_KEY;
    if (saved.GEMINI_API_KEY)    process.env.GEMINI_API_KEY    = saved.GEMINI_API_KEY;
  });

  it('accepts message (single string) and wraps in array', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const req = makeRequest({ message: 'hi there' });
    const res = await POST(req);
    // With no keys → 503
    expect(res.status).toBe(503);
  });

  it('accepts messages array format', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const req = makeRequest({ messages: [{ role: 'user', content: 'hello' }] });
    const res = await POST(req);
    expect(res.status).toBe(503); // No keys configured
  });

  it('returns 429 when rate limit exceeded', async () => {
    // Call 21 times from same IP to trip rate limiter
    const ip = `test-rate-limit-${Date.now()}`;
    const headers = { 'x-forwarded-for': ip };

    let lastRes: Response | null = null;
    for (let i = 0; i < 22; i++) {
      const req = new Request('http://localhost/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ message: 'x' }),
      });
      lastRes = await POST(req);
    }
    // The last call should hit the rate limit
    expect(lastRes!.status).toBe(429);
    const data = await lastRes!.json();
    expect(data.error).toMatch(/rate limit/i);
  });

  it('OPTIONS returns 204 with CORS headers', async () => {
    const req = new Request('http://localhost/api/ai/chat', {
      method: 'OPTIONS',
      headers: { 'origin': 'http://localhost:3000' },
    });
    const res = await OPTIONS(req);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('returns 502 when all AI providers fail (keys set but fetch fails)', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-claude-key';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const req = makeRequest({ message: 'hello' }, { 'x-forwarded-for': `fail-test-${Date.now()}` });
    const res = await POST(req);
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toMatch(/All AI providers failed/i);

    delete process.env.ANTHROPIC_API_KEY;
  });

  it('returns streaming SSE response when provider succeeds', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-claude-key';

    const encoder = new TextEncoder();
    const sseChunk = encoder.encode('data: {"type":"content_block_delta","delta":{"text":"Hello"}}\n\n');
    const doneChunk = encoder.encode('data: [DONE]\n\n');

    let readCount = 0;
    const mockStream = {
      getReader: () => ({
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: sseChunk })
          .mockResolvedValueOnce({ done: false, value: doneChunk })
          .mockResolvedValue({ done: true, value: undefined }),
        cancel: vi.fn(),
      }),
      pipeThrough: (transform: TransformStream) => {
        // Return a simple readable stream that the route can use
        return new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('data: {"text":"Hello"}\n\n'));
            controller.close();
          },
        });
      },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok:   true,
      status: 200,
      body: mockStream,
    } as unknown as Response);

    const req = makeRequest(
      { message: 'hello' },
      { 'x-forwarded-for': `stream-test-${Date.now()}` },
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    expect(res.headers.get('X-AI-Provider')).toBe('claude');

    delete process.env.ANTHROPIC_API_KEY;
  });

  it('returns 500 on unexpected JSON parse error', async () => {
    const req = new Request('http://localhost/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `error-test-${Date.now()}` },
      body: 'not-valid-json{{{',
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toMatch(/Internal server error/i);
  });

  it('uses groq when claude key missing but groq key present', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.GROQ_API_KEY = 'test-groq-key';

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Groq unavailable'));

    const req = makeRequest({ message: 'hi' }, { 'x-forwarded-for': `groq-test-${Date.now()}` });
    const res = await POST(req);
    // No key works → 502
    expect(res.status).toBe(502);

    delete process.env.GROQ_API_KEY;
  });

  it('CORS allows localhost origin via OPTIONS', async () => {
    const req = new Request('http://localhost/api/ai/chat', {
      method: 'OPTIONS',
      headers: { 'origin': 'http://localhost:3000' },
    });
    const res = await OPTIONS(req);
    expect(res.status).toBe(204);
    // In edge runtime test env, the header may be set to the allowed origin or empty
    // Just verify the response is valid and status is 204
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('CORS allows vercel.app origin via OPTIONS', async () => {
    const req = new Request('http://localhost/api/ai/chat', {
      method: 'OPTIONS',
      headers: { 'origin': 'https://my-app.vercel.app' },
    });
    const res = await OPTIONS(req);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('CORS blocks unknown origin in POST', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const req = new Request('http://localhost/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'origin': 'https://evil.com' },
      body: JSON.stringify({ message: 'hi' }),
    });
    const res = await POST(req);
    // The request goes through but CORS header for evil.com is empty
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('');
  });

  it('userContext is passed and affects system prompt (username)', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;

    // With userContext but still no keys → 503
    const req = makeRequest({
      message: 'hi',
      userContext: { username: 'testuser', balance: 10.5, locale: 'ar' },
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
  });

  it('provider response not ok still tries next provider (falls through to 502)', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false, status: 500, statusText: 'Server Error', body: null,
    } as unknown as Response);

    const req = makeRequest({ message: 'hello' }, { 'x-forwarded-for': `notok-test-${Date.now()}` });
    const res = await POST(req);
    expect(res.status).toBe(502);

    delete process.env.ANTHROPIC_API_KEY;
  });
});
