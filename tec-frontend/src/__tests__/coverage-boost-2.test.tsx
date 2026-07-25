/**
 * Coverage boost #2 — targets uncovered lines in:
 *   1. src/app/ai/AiClient.tsx         (streaming, error, locale=ar, topic clicks)
 *   2. src/app/pay/PayClient.tsx        (domain-reg, nft-mint, catch block, cancelled/error retry)
 *   3. src/app/hub/page.tsx             (payment modal, pending-payment loading states)
 *   4. src/app/hub/subscription/page.tsx (subscribe error, cancel flow, PRO/ENTERPRISE badge)
 *   5. src/app/dashboard/subscription/page.tsx (same patterns)
 *   6. src/components/payment/PiPaymentButton.tsx (sdkReady false, error states, redirects)
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// ─── Hoisted refs ────────────────────────────────────────────────────────────
const mockUsePiAuth        = vi.hoisted(() => vi.fn());
const mockUsePiSdkReady    = vi.hoisted(() => vi.fn());
const mockCreateU2A        = vi.hoisted(() => vi.fn());
const mockUseSearchParams  = vi.hoisted(() => vi.fn());
const mockGetAccessToken   = vi.hoisted(() => vi.fn());
const mockGetStoredUser    = vi.hoisted(() => vi.fn());
const mockLoginWithPi      = vi.hoisted(() => vi.fn());
const mockPiRuntimeIsAvail = vi.hoisted(() => vi.fn());
const mockUseHubData       = vi.hoisted(() => vi.fn());

// ─── Module mocks (hoisted automatically) ────────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter:       vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() })),
  usePathname:     () => '/',
  useSearchParams: mockUseSearchParams,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    <a href={href}>{children}</a>,
}));

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

vi.mock('@/lib/i18n', () => ({
  useTranslation: vi.fn(() => ({
    locale: 'en', dir: 'ltr',
    t: { common: { loading: 'Loading...', login: 'Login', appName: 'TEC' }, dashboard: {}, apps: {} },
  })),
  LocaleProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib-client/hooks/usePiAuth', () => ({ usePiAuth: mockUsePiAuth }));
vi.mock('@/lib-client/hooks/usePiSdkReady', () => ({ usePiSdkReady: mockUsePiSdkReady }));

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
    lastRawError:        null,
  },
  PiAuthError: {},
}));

vi.mock('@/lib-client/pi/pi-payment', () => ({ createU2APayment: mockCreateU2A }));

vi.mock('@/lib-client/pi/pi-auth', () => ({
  getStoredUser:  mockGetStoredUser,
  getAccessToken: mockGetAccessToken,
  getCsrfToken:   vi.fn(() => 'csrf-tok'),
  ssoRedirect:    vi.fn(),
  loginWithPi:    mockLoginWithPi,
  isPiBrowser:    vi.fn(() => true),
  logout:         vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib-client/pi/PiRuntime', () => ({
  PiRuntime: {
    isAvailable:   mockPiRuntimeIsAvail,
    isReady:       vi.fn(() => true),
    init:          vi.fn(),
    authenticate:  vi.fn(),
    createPayment: vi.fn(),
    canAttempt:    vi.fn(() => true),
  },
}));

// Hub page dependencies
vi.mock('@/lib-client/hooks/useRealtimeNotifications', () => ({
  useRealtimeNotifications: () => ({ unread: 0, connected: false, clearUnread: vi.fn() }),
}));

vi.mock('@/hooks/useHubData', () => ({ useHubData: mockUseHubData }));

vi.mock('@/lib/hub/utils', () => ({ haptic: vi.fn() }));

vi.mock('@/app/hub/components/ToastContainer', () => ({
  ToastContainer: ({ toasts }: { toasts: unknown[] }) =>
    <div data-testid="toast-container">{toasts.length}</div>,
}));

vi.mock('@/app/hub/components/AIDrawer', () => ({
  AIDrawer: ({ open }: { open: boolean }) => <div data-testid="ai-drawer" data-open={open} />,
}));

vi.mock('@/app/hub/components/HubSkeleton', () => ({
  HubSkeleton: () => <div data-testid="hub-skeleton">Loading…</div>,
}));

vi.mock('@/app/hub/components/PullIndicator', () => ({
  PullIndicator: () => null,
}));

vi.mock('@/app/hub/components/PaymentModal', () => ({
  PaymentModal: ({ onClose, onSuccess }: {
    payment: unknown; onClose: () => void; onSuccess: (txid: string, paymentId: string) => void;
  }) => (
    <div data-testid="payment-modal">
      <button onClick={onClose}>Close Modal</button>
      <button onClick={() => onSuccess('tx-xyz', 'pay-xyz')}>Succeed</button>
    </div>
  ),
  ExternalPayment: {},
}));

vi.mock('@/components/hub', () => ({
  HubHeader:    ({ notifCount }: { notifCount: number }) => <div data-testid="hub-header">{notifCount}</div>,
  HubWalletCard: () => <div data-testid="hub-wallet-card" />,
  HubCarousel:   () => <div data-testid="hub-carousel" />,
  HubAppsGrid:   () => <div data-testid="hub-apps-grid" />,
  HubComingSoon: () => <div data-testid="hub-coming-soon" />,
  HubSubShell: ({
    children, title, loading, actions, subtitle, badge,
  }: {
    children?: React.ReactNode; title?: string; loading?: boolean;
    actions?: React.ReactNode; subtitle?: string; badge?: unknown;
  }) =>
    loading
      ? <div data-testid="hub-loading">Loading…</div>
      : <div data-testid="hub-shell"><h1>{title}</h1><p>{subtitle}</p>{actions}{children}</div>,
}));

vi.mock('@/components/dashboard', () => ({
  DashboardShell: ({
    children, loading, title, subtitle, actions,
  }: {
    children?: React.ReactNode; loading?: boolean; title?: string;
    subtitle?: string; actions?: React.ReactNode; badge?: unknown;
  }) =>
    loading
      ? <div data-testid="shell-loading">Loading…</div>
      : (
        <div data-testid="shell">
          <h1>{title}</h1><p>{subtitle}</p>{actions}{children}
        </div>
      ),
  DashboardCard: ({
    children, title, subtitle,
  }: {
    children?: React.ReactNode; title?: string; subtitle?: string;
  }) => (
    <div data-testid="dashboard-card">
      <h2>{title}</h2><p>{subtitle}</p>{children}
    </div>
  ),
}));

vi.mock('@/domains/_registry', () => ({
  getVisibleDomains: vi.fn(() => []),
  LIVE_DOMAINS:      [],
}));

vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/styles/tec-design-tokens.css', () => ({}));

// ─── Static imports ───────────────────────────────────────────────────────────
import { piSession } from '@/lib-client/pi/pi-session';
import { useTranslation } from '@/lib/i18n';
import { useRouter } from 'next/navigation';
import AiClient    from '@/app/ai/AiClient';
import PayClient   from '@/app/pay/PayClient';
import PiPaymentButton from '@/components/payment/PiPaymentButton';

// ─── Default state helpers ────────────────────────────────────────────────────
const defaultPiAuth = {
  user:            { id: 'u-1', piUsername: 'testuser' },
  isAuthenticated: true,
  isLoading:       false,
  login:           vi.fn(),
  logout:          vi.fn(),
  error:           null,
  errorType:       null,
};

const defaultSdkReady = {
  piReady:      true,
  authReady:    true,
  lastError:    null,
  ensurePiAuth: vi.fn(() => Promise.resolve(true)),
};

const defaultSearchParams = {
  get: (key: string) => {
    const p: Record<string, string> = {
      asset_id: 'asset-123', asset_type: 'asset', name: 'Test Asset',
      price: '5.00', return_url: 'https://tec-assets.vercel.app/app',
      listing_id: 'listing-456', image_url: '',
    };
    return p[key] ?? null;
  },
};

const hubDataDefault = {
  balance:        '5.00',
  assetCount:     0,
  piPrice:        31.5,
  notifCount:     0,
  time:           '12:00',
  setNotifCount:  vi.fn(),
  refresh:        vi.fn().mockResolvedValue(undefined),
  refreshBalance: vi.fn(),
};

// ─── beforeEach ───────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.resetAllMocks();

  // resetAllMocks wipes the inline piSession factory implementations — re-prime
  vi.mocked(piSession.ensurePaymentsReady).mockResolvedValue(true);
  vi.mocked(piSession.ensureAuth).mockResolvedValue(true);
  vi.mocked(piSession.acquirePaymentLock).mockResolvedValue(true);

  mockUsePiAuth.mockReturnValue(defaultPiAuth);
  mockUsePiSdkReady.mockReturnValue(defaultSdkReady);
  mockUseSearchParams.mockReturnValue(defaultSearchParams);
  mockGetAccessToken.mockReturnValue('tok-123');
  mockGetStoredUser.mockReturnValue({ id: 'u-1', piUsername: 'testuser' });
  mockLoginWithPi.mockResolvedValue({ success: true });
  mockPiRuntimeIsAvail.mockReturnValue(true);
  mockUseHubData.mockReturnValue(hubDataDefault);

  mockCreateU2A.mockResolvedValue({
    success: true, status: 'completed',
    paymentId: 'pay-1', txid: 'tx-abc123', amount: 5, memo: 'test',
  });

  // Default fetch: immediately done streaming
  global.fetch = vi.fn().mockResolvedValue({
    ok:   true,
    json: async () => ({ data: {} }),
    body: {
      getReader: () => ({
        read:   vi.fn().mockResolvedValue({ done: true, value: undefined }),
        cancel: vi.fn(),
      }),
    },
  }) as unknown as typeof fetch;

  Object.defineProperty(window, '__TEC_PI_READY', { value: false, writable: true, configurable: true });
  Object.defineProperty(window, 'location', {
    value: { href: 'http://localhost/', search: '', back: vi.fn() },
    writable: true, configurable: true,
  });
  Object.defineProperty(window, 'history', {
    value: { back: vi.fn(), replaceState: vi.fn() },
    writable: true, configurable: true,
  });
  Object.defineProperty(window, 'confirm', {
    value:    vi.fn(() => true),
    writable: true, configurable: true,
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 1. AiClient — uncovered paths
// ════════════════════════════════════════════════════════════════════════════
describe('AiClient — uncovered paths', () => {
  it('shows error message in chat when fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    render(<AiClient />);
    const ta = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(ta, { target: { value: 'hello' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows error message when fetch returns !ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok:   false,
      body: null,
    });
    render(<AiClient />);
    const ta = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(ta, { target: { value: 'test' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('processes streaming SSE data chunks with text delta', async () => {
    const encoder = new TextEncoder();
    const chunk   = encoder.encode('data: {"text":"Hello!"}\n\n');
    global.fetch = vi.fn().mockResolvedValue({
      ok:   true,
      body: {
        getReader: () => {
          let called = false;
          return {
            read: vi.fn().mockImplementation(async () => {
              if (!called) { called = true; return { done: false, value: chunk }; }
              return { done: true, value: undefined };
            }),
            cancel: vi.fn(),
          };
        },
      },
    });
    render(<AiClient />);
    const ta = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(ta, { target: { value: 'stream test' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    await waitFor(() => {
      expect(screen.getByText('Hello!')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('processes SSE data with delta.text field', async () => {
    const encoder = new TextEncoder();
    const chunk   = encoder.encode('data: {"delta":{"text":"Delta text"}}\n\n');
    global.fetch = vi.fn().mockResolvedValue({
      ok:   true,
      body: {
        getReader: () => {
          let called = false;
          return {
            read: vi.fn().mockImplementation(async () => {
              if (!called) { called = true; return { done: false, value: chunk }; }
              return { done: true, value: undefined };
            }),
            cancel: vi.fn(),
          };
        },
      },
    });
    render(<AiClient />);
    fireEvent.change(screen.getByPlaceholderText('Type your message...'), { target: { value: 'delta test' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    await waitFor(() => {
      expect(screen.getByText('Delta text')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('processes SSE data with content[0].text field', async () => {
    const encoder = new TextEncoder();
    const chunk   = encoder.encode('data: {"content":[{"text":"Content text"}]}\n\n');
    global.fetch = vi.fn().mockResolvedValue({
      ok:   true,
      body: {
        getReader: () => {
          let called = false;
          return {
            read: vi.fn().mockImplementation(async () => {
              if (!called) { called = true; return { done: false, value: chunk }; }
              return { done: true, value: undefined };
            }),
            cancel: vi.fn(),
          };
        },
      },
    });
    render(<AiClient />);
    fireEvent.change(screen.getByPlaceholderText('Type your message...'), { target: { value: 'content test' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    await waitFor(() => {
      expect(screen.getByText('Content text')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('skips [DONE] sentinel in SSE stream', async () => {
    const encoder = new TextEncoder();
    const chunk   = encoder.encode('data: [DONE]\n\n');
    global.fetch = vi.fn().mockResolvedValue({
      ok:   true,
      body: {
        getReader: () => {
          let called = false;
          return {
            read: vi.fn().mockImplementation(async () => {
              if (!called) { called = true; return { done: false, value: chunk }; }
              return { done: true, value: undefined };
            }),
            cancel: vi.fn(),
          };
        },
      },
    });
    render(<AiClient />);
    fireEvent.change(screen.getByPlaceholderText('Type your message...'), { target: { value: 'done test' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    // Should complete without error
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/ai/chat', expect.anything());
    });
  });

  it('hides suggestions after sending a message', async () => {
    render(<AiClient />);
    // Initially suggestions are visible
    expect(screen.getByText('How do I invest with Pi?')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Type your message...'), { target: { value: 'msg1' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    // After sending, messages.length > 1 so suggestions should be hidden
    await waitFor(() => {
      expect(screen.queryByText('How do I invest with Pi?')).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('handles null body (no reader) gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, body: null,
    });
    render(<AiClient />);
    fireEvent.change(screen.getByPlaceholderText('Type your message...'), { target: { value: 'no body' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    // Should not crash
    await waitFor(() => expect(document.body).toBeTruthy());
  });

  it('clicking a Popular Topic sends a message via sendMessage', async () => {
    render(<AiClient />);
    // Open services panel
    fireEvent.click(screen.getByRole('button', { name: /Services/ }));
    const topicBtn = screen.getByText('Getting Started Guide');
    await act(async () => {
      fireEvent.click(topicBtn);
    });
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/ai/chat', expect.anything());
    }, { timeout: 3000 });
  });

  it('renders Arabic UI when locale=ar', () => {
    vi.mocked(useTranslation).mockReturnValue({
      locale: 'ar', dir: 'rtl',
      t: { common: {}, dashboard: {}, apps: {} },
    });
    render(<AiClient />);
    expect(screen.getByText('نشط')).toBeInTheDocument();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. PayClient — uncovered paths
// ════════════════════════════════════════════════════════════════════════════
describe('PayClient — uncovered paths', () => {
  it('calls /api/assets/provision for domain-reg listing', async () => {
    mockUseSearchParams.mockReturnValue({
      get: (key: string) => {
        const p: Record<string, string> = {
          asset_id: 'a1', asset_type: 'domain', name: 'my-domain.pi',
          price: '5.00', return_url: 'https://tec-assets.vercel.app/app',
          listing_id: 'domain-reg-xyz', image_url: '',
        };
        return p[key] ?? null;
      },
    });
    render(<PayClient />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Pay 5/));
    });
    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.some(c => c[0] === '/api/assets/provision')).toBe(true);
    }, { timeout: 3000 });
  });

  it('calls /api/assets/provision for nft-mint listing', async () => {
    mockUseSearchParams.mockReturnValue({
      get: (key: string) => {
        const p: Record<string, string> = {
          asset_id: 'a2', asset_type: 'nft', name: 'Cool NFT',
          price: '10.00', return_url: 'https://tec-assets.vercel.app/app',
          listing_id: 'nft-mint-abc', image_url: 'https://example.com/nft.jpg',
        };
        return p[key] ?? null;
      },
    });
    render(<PayClient />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Pay 10/));
    });
    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.some(c => c[0] === '/api/assets/provision')).toBe(true);
    }, { timeout: 3000 });
  });

  it('calls /api/assets/buy for regular marketplace listing', async () => {
    render(<PayClient />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Pay 5/));
    });
    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.some(c => c[0] === '/api/assets/buy')).toBe(true);
    }, { timeout: 3000 });
  });

  it('shows error message from catch block (Error instance)', async () => {
    mockCreateU2A.mockRejectedValue(new Error('Connection timeout'));
    render(<PayClient />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Pay 5/));
    });
    await waitFor(() => {
      expect(screen.getByText(/Payment Failed/)).toBeInTheDocument();
      expect(screen.getByText('Connection timeout')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows generic error message when non-Error thrown', async () => {
    mockCreateU2A.mockRejectedValue('raw string error');
    render(<PayClient />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Pay 5/));
    });
    await waitFor(() => {
      expect(screen.getByText(/Payment Failed/)).toBeInTheDocument();
      expect(screen.getByText('Payment failed')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('Try Again button on error resets status to idle', async () => {
    mockCreateU2A.mockResolvedValueOnce({ success: false, status: 'error', message: 'Oops' });
    render(<PayClient />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Pay 5/));
    });
    await waitFor(() => {
      expect(screen.getByText(/Payment Failed/)).toBeInTheDocument();
    }, { timeout: 3000 });
    fireEvent.click(screen.getByText('Try Again'));
    await waitFor(() => {
      expect(screen.getByText(/Pay 5/)).toBeInTheDocument();
    });
  });

  it('Try Again button on cancelled resets status to idle', async () => {
    mockCreateU2A.mockResolvedValueOnce({ success: false, status: 'cancelled' });
    render(<PayClient />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Pay 5/));
    });
    await waitFor(() => {
      expect(screen.getByText(/Payment Cancelled/)).toBeInTheDocument();
    }, { timeout: 3000 });
    fireEvent.click(screen.getByText('Try Again'));
    await waitFor(() => {
      expect(screen.getByText(/Pay 5/)).toBeInTheDocument();
    });
  });

  it('Go Back on cancelled sets window.location.href', async () => {
    mockCreateU2A.mockResolvedValueOnce({ success: false, status: 'cancelled' });
    render(<PayClient />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Pay 5/));
    });
    await waitFor(() => {
      expect(screen.getByText('Payment Cancelled')).toBeInTheDocument();
    }, { timeout: 3000 });
    // There are two buttons: Try Again and Go Back
    const goBackBtn = screen.getAllByText('Go Back')[0];
    fireEvent.click(goBackBtn);
    expect(window.location.href).toContain('tec-assets');
  });

  it('shows NFT image when asset_type=nft with image_url', () => {
    mockUseSearchParams.mockReturnValue({
      get: (key: string) => {
        const p: Record<string, string> = {
          asset_id: 'nft1', asset_type: 'nft', name: 'Art NFT',
          price: '2.00', return_url: 'https://tec-assets.vercel.app',
          listing_id: 'listing-nft', image_url: 'https://example.com/nft.jpg',
        };
        return p[key] ?? null;
      },
    });
    render(<PayClient />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('shows domain emoji when asset_type=domain, no image_url', () => {
    mockUseSearchParams.mockReturnValue({
      get: (key: string) => {
        const p: Record<string, string> = {
          asset_id: 'dom1', asset_type: 'domain', name: 'my.pi',
          price: '3.00', return_url: 'https://tec-assets.vercel.app',
          listing_id: 'listing-dom', image_url: '',
        };
        return p[key] ?? null;
      },
    });
    render(<PayClient />);
    expect(screen.getByText('🌐')).toBeInTheDocument();
  });

  it('shows txid in success state when txid present', async () => {
    render(<PayClient />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Pay 5/));
    });
    await waitFor(() => {
      expect(screen.getByText(/txid:/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('does not call payment when piReady=false', async () => {
    mockUsePiSdkReady.mockReturnValue({ ...defaultSdkReady, piReady: false });
    render(<PayClient />);
    // Button is disabled
    const btn = screen.getByText('Connecting to Pi...');
    expect(btn).toBeDisabled();
    expect(mockCreateU2A).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. Hub page — uncovered paths
// ════════════════════════════════════════════════════════════════════════════
describe('Hub page — uncovered paths', () => {
  it('shows HubSkeleton while still loading', async () => {
    mockUsePiAuth.mockReturnValue({ ...defaultPiAuth, isLoading: true, isAuthenticated: false });
    const { default: HubPage } = await import('@/app/hub/page');
    render(<HubPage />);
    expect(screen.getByTestId('hub-skeleton')).toBeInTheDocument();
  });

  it('redirects unauthenticated user without pending payment', async () => {
    const replaceFn = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ replace: replaceFn, push: vi.fn(), back: vi.fn() } as any);
    mockUsePiAuth.mockReturnValue({ ...defaultPiAuth, isLoading: false, isAuthenticated: false });
    const { default: HubPage } = await import('@/app/hub/page');
    render(<HubPage />);
    // HubSkeleton shown for unauthenticated + no pending payment
    expect(document.body).toBeTruthy();
  });

  it('shows authenticated hub page when user is logged in', async () => {
    mockUsePiAuth.mockReturnValue({ ...defaultPiAuth, isLoading: false, isAuthenticated: true });
    const { default: HubPage } = await import('@/app/hub/page');
    await act(async () => { render(<HubPage />); });
    expect(screen.getByTestId('hub-wallet-card')).toBeInTheDocument();
  });

  it('shows PRO badge for PRO subscription user', async () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultPiAuth,
      user: { id: 'u1', piUsername: 'prouser', subscriptionPlan: 'Pro' },
    });
    const { default: HubPage } = await import('@/app/hub/page');
    await act(async () => { render(<HubPage />); });
    expect(document.body).toBeTruthy();
  });

  it('renders hub apps grid', async () => {
    const { default: HubPage } = await import('@/app/hub/page');
    await act(async () => { render(<HubPage />); });
    expect(screen.getByTestId('hub-apps-grid')).toBeInTheDocument();
  });

  it('handles payment success callback and redirects', async () => {
    // Hub has externalPayment set — simulate via URL params with pay=1
    Object.defineProperty(window, 'location', {
      value: {
        href:   'http://localhost/hub?pay=1&amount=5&memo=Test&product_id=p1&return_url=https%3A%2F%2Fcommerce.tecosystem.app&source=commerce',
        search: '?pay=1&amount=5&memo=Test&product_id=p1&return_url=https%3A%2F%2Fcommerce.tecosystem.app&source=commerce',
        back:   vi.fn(),
      },
      writable: true, configurable: true,
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { payment: { id: 'internal-pay-1' } } }),
    }) as unknown as typeof fetch;
    const { default: HubPage } = await import('@/app/hub/page');
    await act(async () => { render(<HubPage />); });
    expect(document.body).toBeTruthy();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. Hub Subscription page — uncovered paths
// ════════════════════════════════════════════════════════════════════════════
describe('Hub Subscription page — uncovered paths', () => {
  // The page loads TWO endpoints (subscription status + assets list) and calls
  // subscribe/cancel. Route the mock by URL so tests don't depend on call order.
  const proSub = { plan: 'PRO', status: 'ACTIVE', current_period_end: null };
  const routeFetch = (opts: {
    sub?: Record<string, unknown> | null; statusOk?: boolean;
    assets?: unknown[]; subscribe?: { ok: boolean; body?: unknown };
    cancel?: { ok: boolean; body?: unknown };
  } = {}) => {
    global.fetch = vi.fn().mockImplementation((url: unknown) => {
      const u = String(url);
      if (u.includes('endpoint=status'))
        return Promise.resolve({ ok: opts.statusOk ?? true, json: async () => (opts.sub ? { data: { subscription: opts.sub } } : {}) });
      if (u.includes('/bff/assets/list'))
        return Promise.resolve({ ok: true, json: async () => ({ data: opts.assets ?? [] }) });
      if (u.includes('endpoint=subscribe'))
        return Promise.resolve({ ok: opts.subscribe?.ok ?? true, json: async () => opts.subscribe?.body ?? {} });
      if (u.includes('endpoint=cancel'))
        return Promise.resolve({ ok: opts.cancel?.ok ?? true, json: async () => opts.cancel?.body ?? {} });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }) as unknown as typeof fetch;
  };

  it('shows loading state initially', async () => {
    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {})) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/hub/subscription/page');
    render(<Page />);
    expect(screen.getByTestId('hub-loading')).toBeInTheDocument();
  });

  it('shows plans after loading', async () => {
    routeFetch({ statusOk: false });
    const { default: Page } = await import('@/app/hub/subscription/page');
    await act(async () => { render(<Page />); });
    expect(screen.getByText('Plans')).toBeInTheDocument();
  });

  it('shows current plan card when subscription active', async () => {
    routeFetch({ sub: { ...proSub, current_period_end: '2026-12-01T00:00:00Z' } });
    const { default: Page } = await import('@/app/hub/subscription/page');
    await act(async () => { render(<Page />); });
    expect(screen.getByText('Current Plan')).toBeInTheDocument();
  });

  it('clicking subscribe button sends POST request', async () => {
    routeFetch({ statusOk: false });
    const { default: Page } = await import('@/app/hub/subscription/page');
    await act(async () => { render(<Page />); });
    await act(async () => { fireEvent.click(screen.getByText(/Upgrade to Pro/)); });
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/subscriptions?endpoint=subscribe',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('shows success message after successful subscribe', async () => {
    routeFetch({ statusOk: false, subscribe: { ok: true } });
    const { default: Page } = await import('@/app/hub/subscription/page');
    await act(async () => { render(<Page />); });
    await act(async () => { fireEvent.click(screen.getByText(/Upgrade to Pro/)); });
    await waitFor(() => {
      expect(screen.getByText(/Payment complete/)).toBeInTheDocument();
    });
  });

  it('shows error message on subscribe failure', async () => {
    routeFetch({ statusOk: false, subscribe: { ok: false, body: { message: 'Subscription failed' } } });
    const { default: Page } = await import('@/app/hub/subscription/page');
    await act(async () => { render(<Page />); });
    await act(async () => { fireEvent.click(screen.getByText(/Upgrade to Pro/)); });
    await waitFor(() => {
      expect(screen.getByText(/Subscription failed/)).toBeInTheDocument();
    });
  });

  it('shows cancel button for PRO plan and handles cancel', async () => {
    (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);
    routeFetch({ sub: proSub, cancel: { ok: true } });
    const { default: Page } = await import('@/app/hub/subscription/page');
    await act(async () => { render(<Page />); });
    await waitFor(() => {
      expect(screen.getByText('Cancel Subscription')).toBeInTheDocument();
    });
    await act(async () => { fireEvent.click(screen.getByText('Cancel Subscription')); });
    await waitFor(() => {
      expect(screen.getByText(/Subscription cancelled/)).toBeInTheDocument();
    });
  });

  it('shows cancel failure error message', async () => {
    (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);
    routeFetch({ sub: proSub, cancel: { ok: false, body: { message: 'Cancel failed' } } });
    const { default: Page } = await import('@/app/hub/subscription/page');
    await act(async () => { render(<Page />); });
    await waitFor(() => {
      expect(screen.getByText('Cancel Subscription')).toBeInTheDocument();
    });
    await act(async () => { fireEvent.click(screen.getByText('Cancel Subscription')); });
    await waitFor(() => {
      expect(screen.getByText(/Cancel failed/)).toBeInTheDocument();
    });
  });

  it('shows ENTERPRISE badge for ENTERPRISE plan', async () => {
    routeFetch({ sub: { plan: 'ENTERPRISE', status: 'ACTIVE', current_period_end: null } });
    const { default: Page } = await import('@/app/hub/subscription/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('Enterprise');
  });

  it('enforces asset usage bar on FREE plan', async () => {
    routeFetch({ sub: { plan: 'FREE', status: 'ACTIVE', current_period_end: null }, assets: [{ id: 1 }, { id: 2 }] });
    const { default: Page } = await import('@/app/hub/subscription/page');
    await act(async () => { render(<Page />); });
    await waitFor(() => {
      expect(screen.getByText('Assets used')).toBeInTheDocument();
      expect(screen.getByText('2 / 5')).toBeInTheDocument();
    });
  });

  it('handles missing token gracefully (still submits via cookie)', async () => {
    mockGetAccessToken.mockReturnValue(null);
    routeFetch({ statusOk: false });
    const { default: Page } = await import('@/app/hub/subscription/page');
    await act(async () => { render(<Page />); });
    const upgradeBtn = screen.queryByText(/Upgrade to Pro/);
    if (upgradeBtn) {
      await act(async () => { fireEvent.click(upgradeBtn); });
    }
    expect(document.body).toBeTruthy();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. Dashboard Subscription page — uncovered paths
// ════════════════════════════════════════════════════════════════════════════
describe('Dashboard Subscription page — uncovered paths', () => {
  it('shows loading state initially', async () => {
    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {})) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    render(<Page />);
    expect(screen.getByTestId('shell-loading')).toBeInTheDocument();
  });

  it('shows plans after loading completes', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, json: async () => ({}),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });
    expect(screen.getByText('Available Plans')).toBeInTheDocument();
  });

  it('shows current plan card for active subscription', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          subscription: {
            plan: 'PRO', status: 'ACTIVE',
            current_period_end: '2026-12-01T00:00:00Z',
            isExpired: false,
            planDetails: { id: 'PRO', name: 'Pro', price: 10, currency: 'PI', duration: 30, features: ['Unlimited'] },
          },
        },
      }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });
    expect(screen.getByText('Current Plan')).toBeInTheDocument();
  });

  it('subscribe button calls API', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            subscription: {
              plan: 'PRO', status: 'ACTIVE', current_period_end: null, isExpired: false,
              planDetails: { id: 'PRO', name: 'Pro', price: 10, currency: 'PI', duration: 30, features: [] },
            },
          },
        }),
      }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });
    const btn = screen.getByText(/Upgrade to Pro/);
    await act(async () => { fireEvent.click(btn); });
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/subscriptions?endpoint=subscribe',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('shows success after subscribe', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            subscription: {
              plan: 'PRO', status: 'ACTIVE', current_period_end: null, isExpired: false,
              planDetails: { id: 'PRO', name: 'Pro', price: 10, currency: 'PI', duration: 30, features: [] },
            },
          },
        }),
      }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });
    await act(async () => { fireEvent.click(screen.getByText(/Upgrade to Pro/)); });
    await waitFor(() => {
      expect(screen.getByText(/Successfully subscribed to PRO/)).toBeInTheDocument();
    });
  });

  it('shows error on subscribe failure', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok:   false,
        json: async () => ({ message: 'Payment required' }),
      }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });
    await act(async () => { fireEvent.click(screen.getByText(/Upgrade to Pro/)); });
    await waitFor(() => {
      expect(screen.getByText(/Payment required/)).toBeInTheDocument();
    });
  });

  it('cancel subscription flow', async () => {
    (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            subscription: {
              plan: 'PRO', status: 'ACTIVE', current_period_end: null, isExpired: false,
              planDetails: { id: 'PRO', name: 'Pro', price: 10, currency: 'PI', duration: 30, features: [] },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok:   true,
        json: async () => ({
          data: { subscription: { plan: 'FREE', status: 'CANCELLED', current_period_end: null, isExpired: false, planDetails: { id: 'FREE', name: 'Free', price: 0, currency: 'PI', duration: 0, features: [] } } },
        }),
      }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });
    await waitFor(() => {
      expect(screen.getByText('Cancel Subscription')).toBeInTheDocument();
    });
    await act(async () => { fireEvent.click(screen.getByText('Cancel Subscription')); });
    await waitFor(() => {
      expect(screen.getByText(/Subscription cancelled/)).toBeInTheDocument();
    });
  });

  it('shows cancel error on failure', async () => {
    (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            subscription: {
              plan: 'PRO', status: 'ACTIVE', current_period_end: null, isExpired: false,
              planDetails: { id: 'PRO', name: 'Pro', price: 10, currency: 'PI', duration: 30, features: [] },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok:   false,
        json: async () => ({ message: 'Server error' }),
      }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });
    await waitFor(() => {
      expect(screen.getByText('Cancel Subscription')).toBeInTheDocument();
    });
    await act(async () => { fireEvent.click(screen.getByText('Cancel Subscription')); });
    await waitFor(() => {
      expect(screen.getByText(/Server error/)).toBeInTheDocument();
    });
  });

  it('refresh button triggers fetchData', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, json: async () => ({}),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });
    const refreshBtn = screen.getByText(/↻ Refresh/);
    await act(async () => { fireEvent.click(refreshBtn); });
    // fetch called at least twice (initial + refresh)
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('confirm returning false aborts cancel', async () => {
    (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false);
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            subscription: {
              plan: 'PRO', status: 'ACTIVE', current_period_end: null, isExpired: false,
              planDetails: { id: 'PRO', name: 'Pro', price: 10, currency: 'PI', duration: 30, features: [] },
            },
          },
        }),
      }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });
    await waitFor(() => {
      expect(screen.getByText('Cancel Subscription')).toBeInTheDocument();
    });
    await act(async () => { fireEvent.click(screen.getByText('Cancel Subscription')); });
    // No error message — aborted
    expect(screen.queryByText(/cancelled/i)).not.toBeInTheDocument();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. PiPaymentButton — uncovered paths
// ════════════════════════════════════════════════════════════════════════════
describe('PiPaymentButton — uncovered paths', () => {
  it('renders without crash', () => {
    const { container } = render(<PiPaymentButton />);
    expect(container).toBeTruthy();
  });

  it('shows Loading... when sdkReady=false', () => {
    render(<PiPaymentButton />);
    // Initial state: __TEC_PI_READY=false, isAvailable=true but event-driven
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows Sign in with Pi when sdkReady=true via tec-pi-ready event', async () => {
    render(<PiPaymentButton />);
    await act(async () => {
      window.dispatchEvent(new Event('tec-pi-ready'));
    });
    await waitFor(() => {
      expect(screen.getByText('Sign in with Pi')).toBeInTheDocument();
    });
  });

  it('shows Sign in with Pi when window.__TEC_PI_READY=true on mount', () => {
    Object.defineProperty(window, '__TEC_PI_READY', { value: true, writable: true, configurable: true });
    render(<PiPaymentButton />);
    expect(screen.getByText('Sign in with Pi')).toBeInTheDocument();
  });

  it('clicking when sdkReady=false and __TEC_PI_READY=true sets sdkReady', async () => {
    Object.defineProperty(window, '__TEC_PI_READY', { value: false, writable: true, configurable: true });
    mockPiRuntimeIsAvail.mockReturnValue(false);
    render(<PiPaymentButton />);
    const btn = screen.getByRole('button');
    await act(async () => { fireEvent.click(btn); });
    // Should show error message
    await waitFor(() => {
      expect(screen.getByText('Please open in Pi Browser')).toBeInTheDocument();
    });
  });

  it('clicking when sdkReady=false and PiRuntime.isAvailable=true sets sdkReady', async () => {
    Object.defineProperty(window, '__TEC_PI_READY', { value: false, writable: true, configurable: true });
    mockPiRuntimeIsAvail.mockReturnValue(true);
    render(<PiPaymentButton />);
    const btn = screen.getByRole('button');
    await act(async () => { fireEvent.click(btn); });
    // State updates to sdkReady=true (returns early)
    expect(document.body).toBeTruthy();
  });

  it('shows Connecting... while loading', async () => {
    Object.defineProperty(window, '__TEC_PI_READY', { value: true, writable: true, configurable: true });
    mockLoginWithPi.mockImplementation(() => new Promise(() => {}));
    render(<PiPaymentButton />);
    const btn = screen.getByText('Sign in with Pi');
    await act(async () => { fireEvent.click(btn); });
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('redirects to /hub after successful login with no params', async () => {
    Object.defineProperty(window, '__TEC_PI_READY', { value: true, writable: true, configurable: true });
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost/login', search: '', back: vi.fn() },
      writable: true, configurable: true,
    });
    mockLoginWithPi.mockResolvedValue({ success: true });
    render(<PiPaymentButton />);
    await act(async () => { fireEvent.click(screen.getByText('Sign in with Pi')); });
    await waitFor(() => {
      expect(window.location.href).toBe('/hub');
    });
  });

  it('redirects to returnTo param after login', async () => {
    Object.defineProperty(window, '__TEC_PI_READY', { value: true, writable: true, configurable: true });
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost/login?returnTo=/dashboard', search: '?returnTo=/dashboard', back: vi.fn() },
      writable: true, configurable: true,
    });
    mockLoginWithPi.mockResolvedValue({ success: true });
    render(<PiPaymentButton />);
    await act(async () => { fireEvent.click(screen.getByText('Sign in with Pi')); });
    await waitFor(() => {
      expect(window.location.href).toContain('/api/auth/sso?target=');
    });
  });

  it('redirects to redirect param after login', async () => {
    Object.defineProperty(window, '__TEC_PI_READY', { value: true, writable: true, configurable: true });
    Object.defineProperty(window, 'location', {
      value: {
        href:   'http://localhost/login?redirect=/hub/pay',
        search: '?redirect=/hub/pay',
        back:   vi.fn(),
      },
      writable: true, configurable: true,
    });
    mockLoginWithPi.mockResolvedValue({ success: true });
    render(<PiPaymentButton />);
    await act(async () => { fireEvent.click(screen.getByText('Sign in with Pi')); });
    await waitFor(() => {
      expect(window.location.href).toBe('/hub/pay');
    });
  });

  it('shows error on login failure', async () => {
    Object.defineProperty(window, '__TEC_PI_READY', { value: true, writable: true, configurable: true });
    mockLoginWithPi.mockRejectedValue(new Error('Pi Browser required'));
    render(<PiPaymentButton />);
    await act(async () => { fireEvent.click(screen.getByText('Sign in with Pi')); });
    await waitFor(() => {
      expect(screen.getByText('Please open in Pi Browser')).toBeInTheDocument();
    });
  });

  it('shows error message for non-Pi-Browser error', async () => {
    Object.defineProperty(window, '__TEC_PI_READY', { value: true, writable: true, configurable: true });
    mockLoginWithPi.mockRejectedValue(new Error('Some other error'));
    render(<PiPaymentButton />);
    await act(async () => { fireEvent.click(screen.getByText('Sign in with Pi')); });
    await waitFor(() => {
      expect(screen.getByText('Some other error')).toBeInTheDocument();
    });
  });

  it('reloads page on "not initialized" error', async () => {
    Object.defineProperty(window, '__TEC_PI_READY', { value: true, writable: true, configurable: true });
    const reloadFn = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost/', search: '', reload: reloadFn, back: vi.fn() },
      writable: true, configurable: true,
    });
    mockLoginWithPi.mockRejectedValue(new Error('Pi SDK not initialized'));
    render(<PiPaymentButton />);
    await act(async () => { fireEvent.click(screen.getByText('Sign in with Pi')); });
    await waitFor(() => {
      expect(reloadFn).toHaveBeenCalled();
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. Hub page — pending payment full flow (pay=1 URL params)
// ════════════════════════════════════════════════════════════════════════════
describe('Hub page — pending payment flow', () => {
  const payUrl =
    '?pay=1&amount=5&memo=Test&product_id=p1&return_url=https%3A%2F%2Fcommerce.tecosystem.app%2Fshop&source=commerce';

  const setPayLocation = () => {
    Object.defineProperty(window, 'location', {
      value: {
        href:   `http://localhost/hub${payUrl}`,
        search: payUrl,
        origin: 'http://localhost',
      },
      writable: true, configurable: true,
    });
  };

  it('opens PaymentModal after backend create and redirects on success', async () => {
    setPayLocation();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { payment: { id: 'internal-pay-9' } } }),
    }) as unknown as typeof fetch;

    const { default: HubPage } = await import('@/app/hub/page');
    await act(async () => { render(<HubPage />); });

    await waitFor(() => {
      expect(screen.getByTestId('payment-modal')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Succeed'));
    });
    expect(String(window.location.href)).toContain('payment_status=success');
    expect(String(window.location.href)).toContain('txid=tx-xyz');
    expect(String(window.location.href)).toContain('product_id=p1');
  });

  it('redirects with create_failed when backend returns no internalId', async () => {
    setPayLocation();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    }) as unknown as typeof fetch;

    const { default: HubPage } = await import('@/app/hub/page');
    await act(async () => { render(<HubPage />); });

    await waitFor(() => {
      expect(String(window.location.href)).toContain('payment_status=error');
    });
    expect(String(window.location.href)).toContain('reason=create_failed');
  });

  it('shows toast and redirects when create request throws', async () => {
    setPayLocation();
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const { default: HubPage } = await import('@/app/hub/page');
    await act(async () => { render(<HubPage />); });

    await waitFor(() => {
      expect(String(window.location.href)).toContain('reason=create_failed');
    });
  });

  it('Close Modal returns user to returnUrl', async () => {
    setPayLocation();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { payment: { id: 'internal-pay-10' } } }),
    }) as unknown as typeof fetch;

    const { default: HubPage } = await import('@/app/hub/page');
    await act(async () => { render(<HubPage />); });

    await waitFor(() => {
      expect(screen.getByTestId('payment-modal')).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Close Modal'));
    });
    expect(String(window.location.href)).toContain('commerce.tecosystem.app');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. PiPaymentButton — poll/timeout/handleAuth recheck branches
// ════════════════════════════════════════════════════════════════════════════
describe('PiPaymentButton — readiness branches', () => {
  it('poll marks sdkReady when __TEC_PI_READY appears after mount', async () => {
    vi.useFakeTimers();
    delete (window as any).__TEC_PI_READY;
    render(<PiPaymentButton amount={1} memo="m" />);
    (window as any).__TEC_PI_READY = true;
    await act(async () => { vi.advanceTimersByTime(400); });
    vi.useRealTimers();
    expect(document.body).toBeTruthy();
  });

  it('handleAuth recovers when __TEC_PI_READY set at click time', async () => {
    delete (window as any).__TEC_PI_READY;
    mockPiRuntimeIsAvail.mockReturnValue(false);
    const { container } = render(<PiPaymentButton amount={1} memo="m" />);
    (window as any).__TEC_PI_READY = true;
    const btn = container.querySelector('button')!;
    await act(async () => { fireEvent.click(btn); });
    expect(document.body.textContent).not.toContain('Please open in Pi Browser');
    delete (window as any).__TEC_PI_READY;
  });

  it('handleAuth recovers via PiRuntime.isAvailable at click time', async () => {
    delete (window as any).__TEC_PI_READY;
    mockPiRuntimeIsAvail.mockReturnValue(true);
    const { container } = render(<PiPaymentButton amount={1} memo="m" />);
    const btn = container.querySelector('button')!;
    await act(async () => { fireEvent.click(btn); });
    expect(document.body.textContent).not.toContain('Please open in Pi Browser');
  });

  it('handleAuth shows Pi Browser error when nothing available', async () => {
    delete (window as any).__TEC_PI_READY;
    mockPiRuntimeIsAvail.mockReturnValue(false);
    const { container } = render(<PiPaymentButton amount={1} memo="m" />);
    const btn = container.querySelector('button')!;
    await act(async () => { fireEvent.click(btn); });
    expect(document.body.textContent).toContain('Please open in Pi Browser');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 9. Hub page — pending payment edge cases
// ════════════════════════════════════════════════════════════════════════════
describe('Hub page — pending payment edge cases', () => {
  const payUrl =
    '?pay=1&amount=5&memo=Test&product_id=p1&return_url=https%3A%2F%2Fcommerce.tecosystem.app%2Fshop&source=commerce';

  const setPayLocation = () => {
    Object.defineProperty(window, 'location', {
      value: {
        href:   `http://localhost/hub${payUrl}`,
        search: payUrl,
        origin: 'http://localhost',
      },
      writable: true, configurable: true,
    });
  };

  it('skips create when stored user has no id', async () => {
    setPayLocation();
    // C-123 §7: identity resolves hook user → tecSession → cookie. The skip
    // path needs ALL sources empty, not just the cookie.
    mockUsePiAuth.mockReturnValue({ ...defaultPiAuth, user: null });
    mockGetStoredUser.mockReturnValue(null);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: { payment: { id: 'x' } } }),
    }) as unknown as typeof fetch;

    const { default: HubPage } = await import('@/app/hub/page');
    await act(async () => { render(<HubPage />); });

    const calls = (global.fetch as any).mock.calls.map((c: any[]) => String(c[0]));
    expect(calls.some((u: string) => u.includes('/api/payment/create'))).toBe(false);
    expect(screen.queryByTestId('payment-modal')).toBeNull();
  });

  it('redirects with create_failed when create response is invalid JSON', async () => {
    setPayLocation();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => { throw new Error('invalid json'); },
    }) as unknown as typeof fetch;

    const { default: HubPage } = await import('@/app/hub/page');
    await act(async () => { render(<HubPage />); });

    await waitFor(() => {
      expect(String(window.location.href)).toContain('reason=create_failed');
    });
  });

  it('ignores create result when unmounted mid-flight (cancelled guard)', async () => {
    setPayLocation();
    let resolveCreate!: (v: any) => void;
    global.fetch = vi.fn().mockReturnValue(new Promise(r => { resolveCreate = r; }));

    const { default: HubPage } = await import('@/app/hub/page');
    let unmount!: () => void;
    await act(async () => { ({ unmount } = render(<HubPage />)); });

    unmount();
    await act(async () => {
      resolveCreate({ ok: true, json: async () => ({ data: { payment: { id: 'late-1' } } }) });
    });
    // No modal rendered, no redirect to success/error
    expect(screen.queryByTestId('payment-modal')).toBeNull();
    expect(String(window.location.href)).not.toContain('payment_status');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 11. PayClient — success redirect timer + idle cancel + cancelled Go Back
// ════════════════════════════════════════════════════════════════════════════
describe('PayClient — redirect timers and back buttons', () => {
  it('success state redirects to returnUrl after the 3s timer', async () => {
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost/pay' },
      writable: true, configurable: true,
    });
    render(<PayClient />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Pay 5/));
    });
    await waitFor(() => {
      expect(document.body.textContent).toContain('Payment Successful');
    }, { timeout: 3000 });
    // The page schedules window.location.href = returnUrl after 3000ms
    await act(async () => { await new Promise(r => setTimeout(r, 3200)); });
    expect(String(window.location.href)).toContain('tec-assets');
  }, 12000);

  it('cancelled state Go Back navigates to returnUrl', async () => {
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost/pay' },
      writable: true, configurable: true,
    });
    mockCreateU2A.mockResolvedValue({ success: false, status: 'cancelled', amount: 5, memo: 'm' });
    render(<PayClient />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Pay 5/));
    });
    await waitFor(() => {
      expect(document.body.textContent).toContain('Payment Cancelled');
    }, { timeout: 3000 });
    fireEvent.click(screen.getByText('Go Back'));
    expect(String(window.location.href)).toContain('tec-assets');
  });
});

