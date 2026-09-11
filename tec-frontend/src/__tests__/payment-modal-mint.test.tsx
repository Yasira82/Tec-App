/**
 * Targeted coverage boost for:
 *   1. src/app/hub/components/PaymentModal.tsx  (60% → target ≥ 85%)
 *   2. src/app/mint/page.tsx                    (61.3% → target ≥ 85%)
 *
 * Focused on uncovered branches:
 *   PaymentModal: handlePay w/ !ready after lock, "Try Again" button, haptic, waitForPiReady
 *   MintPage:     auth status, startMint flow, onReadyForServerApproval/Completion callbacks,
 *                 error handling, tier colors, sdkReady via event
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@/test-utils/render-with-locale';

// ─── Hoisted mock refs ─────────────────────────────────────────────────────────
const mockPiSessionEnsurePaymentsReady = vi.hoisted(() => vi.fn());
const mockPiSessionAcquirePaymentLock  = vi.hoisted(() => vi.fn());
const mockPiSessionReleasePaymentLock  = vi.hoisted(() => vi.fn());
const mockPiSessionReset               = vi.hoisted(() => vi.fn());
const mockPiSessionReInit              = vi.hoisted(() => vi.fn());
const mockPiSessionLastError           = vi.hoisted(() => ({ value: null as string | null }));

const mockPiRuntimeIsAvailable = vi.hoisted(() => vi.fn());
const mockPiRuntimeIsReady     = vi.hoisted(() => vi.fn());
const mockPiRuntimeInit        = vi.hoisted(() => vi.fn());
const mockPiRuntimeCreatePayment = vi.hoisted(() => vi.fn());

const mockCreateU2APayment = vi.hoisted(() => vi.fn());

const mockUsePiAuth     = vi.hoisted(() => vi.fn());
const mockUsePiSdkReady = vi.hoisted(() => vi.fn());

const mockSearchParamsGet = vi.hoisted(() => vi.fn());

// ─── Module mocks ───────────────────────────────────────────────────────────────

vi.mock('@/lib-client/pi/pi-session', () => ({
  piSession: {
    get lastError()    { return mockPiSessionLastError.value; },
    get lastRawError() { return null; },
    ensurePaymentsReady: (...args: unknown[]) => mockPiSessionEnsurePaymentsReady(...args),
    acquirePaymentLock:  (...args: unknown[]) => mockPiSessionAcquirePaymentLock(...args),
    releasePaymentLock:  (...args: unknown[]) => mockPiSessionReleasePaymentLock(...args),
    reset:               (...args: unknown[]) => mockPiSessionReset(...args),
    reInit:              (...args: unknown[]) => mockPiSessionReInit(...args),
  },
  PiAuthError: {},
}));

vi.mock('@/lib-client/pi/pi-payment', () => ({
  createU2APayment:    (...args: unknown[]) => mockCreateU2APayment(...args),
  createPaymentRecord: vi.fn().mockResolvedValue('payment-id-1'),
}));

vi.mock('@/lib-client/pi/PiRuntime', () => ({
  PiRuntime: {
    isAvailable:    (...args: unknown[]) => mockPiRuntimeIsAvailable(...args),
    isReady:        (...args: unknown[]) => mockPiRuntimeIsReady(...args),
    init:           (...args: unknown[]) => mockPiRuntimeInit(...args),
    createPayment:  (...args: unknown[]) => mockPiRuntimeCreatePayment(...args),
    canAttempt:     vi.fn(() => true),
    authenticate:   vi.fn(),
  },
}));

vi.mock('@/lib-client/hooks/usePiAuth', () => ({
  usePiAuth: (...args: unknown[]) => mockUsePiAuth(...args),
}));

vi.mock('@/lib-client/hooks/usePiSdkReady', () => ({
  usePiSdkReady: (...args: unknown[]) => mockUsePiSdkReady(...args),
}));

vi.mock('next/navigation', () => ({
  useRouter:       () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({ get: (...args: unknown[]) => mockSearchParamsGet(...args) }),
  notFound:        vi.fn(),
}));

vi.mock('@/lib-client/pi/pi-auth', () => ({
  getAccessToken: vi.fn(() => 'test-token'),
  getStoredUser:  vi.fn(() => ({ id: 'u1', piUsername: 'alice' })),
  loginWithPi:    vi.fn(),
  logout:         vi.fn(),
  isPiBrowser:    vi.fn(() => false),
  getCsrfToken:   vi.fn(() => 'csrf'),
}));

// ─── Static imports (after mocks) ──────────────────────────────────────────────
import { PaymentModal } from '@/app/hub/components/PaymentModal';
import MintPage         from '@/app/mint/page';

// ─── Base data ─────────────────────────────────────────────────────────────────
const defaultPayment = {
  amount:     5,
  memo:       'Buy Widget',
  productId:  'prod-1',
  returnUrl:  'https://example.com',
  source:     'commerce',
  internalId: 'int-1',
};

const authedUser = {
  id: 'u1', piUsername: 'alice', subscriptionPlan: 'Free', kycVerified: false,
};

// ─── Setup ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.resetAllMocks();

  // Default: Pi is available and ready
  mockPiRuntimeIsAvailable.mockReturnValue(true);
  mockPiRuntimeIsReady.mockReturnValue(true);

  // Default: payments ready, lock acquired
  mockPiSessionEnsurePaymentsReady.mockResolvedValue(true);
  mockPiSessionAcquirePaymentLock.mockResolvedValue(true);
  mockPiSessionReleasePaymentLock.mockReturnValue(undefined);
  mockPiSessionReset.mockReturnValue(undefined);
  mockPiSessionReInit.mockReturnValue(undefined);

  // Default: createU2APayment succeeds
  mockCreateU2APayment.mockResolvedValue({
    success: true, status: 'completed', txid: 'tx1', paymentId: 'p1',
    amount: 5, memo: 'test',
  });

  // Default: usePiAuth authenticated
  mockUsePiAuth.mockReturnValue({
    user: authedUser, isAuthenticated: true, isLoading: false,
    login: vi.fn(), logout: vi.fn(), error: null, errorType: null,
  });

  // Default: usePiSdkReady ready
  mockUsePiSdkReady.mockReturnValue({
    piReady: true, authReady: true, lastError: null,
    ensurePiAuth: vi.fn().mockResolvedValue(true),
  });

  // Default: searchParams
  mockSearchParamsGet.mockImplementation((key: string) => {
    const map: Record<string, string> = {
      asset_id:   'asset-123',
      name:       'TestDomain',
      tier:       'Common',
      return_url: 'https://assets.tecosystem.app/app',
    };
    return map[key] ?? null;
  });

  // Default: fetch succeeds
  global.fetch = vi.fn().mockResolvedValue({
    ok: true, json: async () => ({ data: { id: 'pay-int-1' } }),
  }) as unknown as typeof fetch;

  // navigator.vibrate
  Object.defineProperty(navigator, 'vibrate', {
    value: vi.fn(), writable: true, configurable: true,
  });

  // window.__TEC_PI_READY
  Object.defineProperty(window, '__TEC_PI_READY', {
    value: false, writable: true, configurable: true,
  });

  // window.location
  Object.defineProperty(window, 'location', {
    value: { href: 'http://localhost/', origin: 'http://localhost' },
    writable: true, configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

// ═══════════════════════════════════════════════════════════════════════════════
// PaymentModal
// ═══════════════════════════════════════════════════════════════════════════════

// The modal's tryAuth sleeps 1000ms (real timer) before ensurePaymentsReady,
// so readiness takes ~1.1s of wall time per test.
const renderModal = (overrides: Partial<typeof defaultPayment> = {}, handlers: {
  onClose?: () => void; onSuccess?: (txid: string, pid: string) => void;
} = {}) =>
  render(
    <PaymentModal
      payment={{ ...defaultPayment, ...overrides }}
      onClose={handlers.onClose ?? vi.fn()}
      onSuccess={handlers.onSuccess ?? vi.fn()}
    />,
  );

const waitForReady = async () => {
  await waitFor(
    () => {
      const btn = screen.getByText(/^Pay \d+π$/) as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    },
    { timeout: 4000 },
  );
};

const clickPay = async () => {
  await waitForReady();
  await act(async () => {
    fireEvent.click(screen.getByText(/^Pay \d+π$/));
  });
};

describe('PaymentModal — idle render', () => {
  it('shows amount, memo, and source label while authenticating', () => {
    renderModal();
    expect(screen.getByText('5π')).toBeTruthy();
    expect(screen.getByText('Buy Widget')).toBeTruthy();
    expect(screen.getByText('TEC Commerce')).toBeTruthy();
    expect(screen.getAllByText('Authenticating...').length).toBeGreaterThan(0);
  });

  it.each([
    ['ecommerce', 'TEC Ecommerce'],
    ['assets',    'TEC Assets'],
    ['unknown',   'TEC Ecosystem'],
  ])('source %s renders label %s', (source, label) => {
    renderModal({ source });
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('Cancel in idle state calls onClose', () => {
    const onClose = vi.fn();
    renderModal({}, { onClose });
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('enables Pay as soon as the SDK is ready — WITHOUT authenticating', async () => {
    // The contract changed deliberately. The modal used to authenticate on
    // mount and hung there forever on the Testnet host: a WebView will not
    // raise Pi's auth dialog for a call no user initiated, and it never says
    // so. Every working path in the fleet (/pi-test, every app's buy handler)
    // authenticates inside the tap, so this one does too.
    renderModal();
    await waitForReady();
    expect(mockPiSessionEnsurePaymentsReady).not.toHaveBeenCalled();
  });
});

describe('PaymentModal — handlePay outcomes', () => {
  it('successful payment shows success state and fires onSuccess', async () => {
    const onSuccess = vi.fn();
    mockCreateU2APayment.mockResolvedValue({
      success: true, status: 'completed', txid: 'tx-abc', paymentId: 'pay-xyz',
      amount: 5, memo: 'test',
    });
    renderModal({}, { onSuccess });
    await clickPay();
    await waitFor(() => expect(screen.getByText('Payment Successful!')).toBeTruthy());
    // onSuccess fires after a 1500ms real setTimeout
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('tx-abc', 'pay-xyz'), { timeout: 3000 });
    expect(mockPiSessionReleasePaymentLock).toHaveBeenCalled();
  });

  it('cancelled payment shows Cancelled and Go Back calls onClose', async () => {
    const onClose = vi.fn();
    mockCreateU2APayment.mockResolvedValue({
      success: false, status: 'cancelled', amount: 5, memo: 'test',
    });
    renderModal({}, { onClose });
    await clickPay();
    await waitFor(() => expect(screen.getByText('Cancelled')).toBeTruthy());
    fireEvent.click(screen.getByText('Go Back'));
    expect(onClose).toHaveBeenCalled();
  });

  it('failed payment result shows Payment Failed with message', async () => {
    mockCreateU2APayment.mockResolvedValue({
      success: false, status: 'failed', message: 'Gateway timeout',
      amount: 5, memo: 'test',
    });
    renderModal();
    await clickPay();
    await waitFor(() => expect(screen.getByText('Payment Failed')).toBeTruthy());
    expect(screen.getByText('Gateway timeout')).toBeTruthy();
  });

  it('createU2APayment throw shows Payment Failed with error message', async () => {
    mockCreateU2APayment.mockRejectedValue(new Error('Pi SDK exploded'));
    renderModal();
    await clickPay();
    await waitFor(() => expect(screen.getByText('Payment Failed')).toBeTruthy());
    expect(screen.getByText('Pi SDK exploded')).toBeTruthy();
  });

  it('error Cancel button calls onClose', async () => {
    const onClose = vi.fn();
    mockCreateU2APayment.mockResolvedValue({
      success: false, status: 'failed', message: 'nope', amount: 5, memo: 'test',
    });
    renderModal({}, { onClose });
    await clickPay();
    await waitFor(() => expect(screen.getByText('Payment Failed')).toBeTruthy());
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows "Open in Pi Browser" when Pi unavailable at pay time', async () => {
    renderModal();
    await waitForReady();
    mockPiRuntimeIsAvailable.mockReturnValue(false);
    await act(async () => {
      fireEvent.click(screen.getByText(/^Pay \d+π$/));
    });
    await waitFor(() => expect(screen.getByText('Open in Pi Browser')).toBeTruthy());
  });

  it('shows "Payment already in progress" when lock not acquired', async () => {
    renderModal();
    await waitForReady();
    mockPiSessionAcquirePaymentLock.mockResolvedValue(false);
    await act(async () => {
      fireEvent.click(screen.getByText(/^Pay \d+π$/));
    });
    await waitFor(() => expect(screen.getByText('Payment already in progress')).toBeTruthy());
  });

  it('surfaces the real auth error when the gate fails inside handlePay', async () => {
    // The message carries `lastError`/`lastRawError` now. "Pi SDK not ready"
    // was the same sentence for four different faults, and reading it cost
    // several rounds of the wrong fix.
    renderModal();
    await waitForReady();
    mockPiSessionEnsurePaymentsReady.mockResolvedValue(false);
    mockPiSessionLastError.value = 'AUTH_FAILED';
    await act(async () => {
      fireEvent.click(screen.getByText(/^Pay \d+π$/));
    });
    await waitFor(() =>
      expect(screen.getByText(/Pi auth \(AUTH_FAILED\)/)).toBeTruthy(),
    );
    mockPiSessionLastError.value = null;
  });
});

describe('PaymentModal — Try Again', () => {
  it('returns to idle with Pay live again, and authenticates NOTHING by itself', async () => {
    mockCreateU2APayment.mockResolvedValue({
      success: false, status: 'failed', message: 'first failure',
      amount: 5, memo: 'test',
    });
    renderModal();
    await clickPay();
    await waitFor(() => expect(screen.getByText('Payment Failed')).toBeTruthy());

    mockPiSessionReset.mockClear();
    mockPiSessionReInit.mockClear();
    mockPiSessionEnsurePaymentsReady.mockClear();
    fireEvent.click(screen.getByText('Try Again'));

    // The session is cleared so the next tap re-authenticates from scratch...
    expect(mockPiSessionReset).toHaveBeenCalled();
    // ...but nothing re-inits the SDK and nothing authenticates on a timer.
    // That timer fired 2s after the tap, with the user gesture long gone — and
    // a WebView will not raise Pi's auth dialog for such a call. It waits
    // silently, which is exactly how this modal used to die.
    expect(mockPiSessionReInit).not.toHaveBeenCalled();

    // Pay is live immediately — no "Authenticating…" limbo to sit in.
    await waitFor(() => {
      const btn = screen.getByText(/^Pay \d+π$/) as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });
    expect(screen.queryByText('Payment Failed')).toBeNull();

    await new Promise(r => setTimeout(r, 2500));
    expect(mockPiSessionEnsurePaymentsReady).not.toHaveBeenCalled();
  }, 10000);
});

describe('PaymentModal — waitForPiReady path', () => {
  it('waits for tec-pi-ready event when PiRuntime.isReady() is false initially', async () => {
    mockPiRuntimeIsReady.mockReturnValue(false);
    renderModal();
    // Modal stuck waiting for the event — fire it
    await act(async () => {
      window.dispatchEvent(new Event('tec-pi-ready'));
    });
    await waitForReady();
  });
});

describe('PaymentModal — the mount effect never authenticates', () => {
  it('does not authenticate, reset or reInit on mount, however long it waits', async () => {
    // The old ladder was: wait, 1s, ensure, reset + reInit, 2.5s, ensure again.
    // Two of those calls are a SECOND Pi.authenticate, which Pi Browser breaks
    // on — the modal could manufacture the very collision the gate exists to
    // prevent. None of it may run without a tap.
    mockPiSessionEnsurePaymentsReady.mockResolvedValue(false);
    mockPiSessionLastError.value = 'AUTH_FAILED';
    renderModal();
    await waitForReady();
    await new Promise(r => setTimeout(r, 4000));

    expect(mockPiSessionEnsurePaymentsReady).not.toHaveBeenCalled();
    expect(mockPiSessionReInit).not.toHaveBeenCalled();
    expect(mockPiSessionReset).not.toHaveBeenCalled();
    expect(screen.queryByText('Payment Failed')).toBeNull();
    mockPiSessionLastError.value = null;
  }, 10000);
});

// ═══════════════════════════════════════════════════════════════════════════════
// MintPage — focused on UNCOVERED branches
// ═══════════════════════════════════════════════════════════════════════════════

describe('MintPage — renders with sdkReady and authenticated', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).__TEC_PI_READY = true;
  });

  it('renders asset name from search params', async () => {
    await act(async () => { render(<MintPage />); });
    expect(document.body.textContent).toContain('TestDomain');
  });

  it('renders tier badge', async () => {
    await act(async () => { render(<MintPage />); });
    expect(document.body.textContent).toContain('COMMON DOMAIN');
  });

  it('renders minting fee of 1π', async () => {
    await act(async () => { render(<MintPage />); });
    expect(document.body.textContent).toContain('1π');
  });

  it('renders Mint as NFT button', async () => {
    await act(async () => { render(<MintPage />); });
    expect(document.body.textContent).toContain('Mint as NFT');
  });

  it('renders Cancel button', async () => {
    await act(async () => { render(<MintPage />); });
    expect(document.body.textContent).toContain('Cancel');
  });
});

describe('MintPage — tier colors (rendering)', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).__TEC_PI_READY = true;
  });

  it('renders Legendary tier', async () => {
    mockSearchParamsGet.mockImplementation((key: string) => {
      const map: Record<string, string> = {
        asset_id: 'a1', name: 'LegendDomain', tier: 'Legendary', return_url: 'https://example.com',
      };
      return map[key] ?? null;
    });
    await act(async () => { render(<MintPage />); });
    expect(document.body.textContent).toContain('LEGENDARY DOMAIN');
  });

  it('renders Ultra Rare tier', async () => {
    mockSearchParamsGet.mockImplementation((key: string) => {
      const map: Record<string, string> = {
        asset_id: 'a2', name: 'UltraDomain', tier: 'Ultra Rare', return_url: 'https://example.com',
      };
      return map[key] ?? null;
    });
    await act(async () => { render(<MintPage />); });
    expect(document.body.textContent).toContain('ULTRA RARE DOMAIN');
  });

  it('renders Rare tier', async () => {
    mockSearchParamsGet.mockImplementation((key: string) => {
      const map: Record<string, string> = {
        asset_id: 'a3', name: 'RareDomain', tier: 'Rare', return_url: 'https://example.com',
      };
      return map[key] ?? null;
    });
    await act(async () => { render(<MintPage />); });
    expect(document.body.textContent).toContain('RARE DOMAIN');
  });

  it('renders Uncommon tier', async () => {
    mockSearchParamsGet.mockImplementation((key: string) => {
      const map: Record<string, string> = {
        asset_id: 'a4', name: 'UncommonDomain', tier: 'Uncommon', return_url: 'https://example.com',
      };
      return map[key] ?? null;
    });
    await act(async () => { render(<MintPage />); });
    expect(document.body.textContent).toContain('UNCOMMON DOMAIN');
  });
});

describe('MintPage — sdkReady via event', () => {
  it('transitions from spinner to content when tec-pi-ready event fires', async () => {
    (window as unknown as Record<string, unknown>).__TEC_PI_READY = false;

    let rendered: ReturnType<typeof render>;
    await act(async () => {
      rendered = render(<MintPage />);
    });

    // Initially spinner shown (sdkReady=false)
    expect(rendered!.container.querySelector('[style*="border-radius: 50%"]')).toBeTruthy();

    // Fire the event
    await act(async () => {
      window.dispatchEvent(new Event('tec-pi-ready'));
    });

    // Now content should show
    await waitFor(() => {
      expect(document.body.textContent).toContain('Mint as NFT');
    });
  });
});

describe('MintPage — loading state', () => {
  it('shows spinner when isLoading=true', async () => {
    mockUsePiAuth.mockReturnValue({
      user: null, isAuthenticated: false, isLoading: true,
      login: vi.fn(), logout: vi.fn(), error: null,
    });
    (window as unknown as Record<string, unknown>).__TEC_PI_READY = true;

    await act(async () => { render(<MintPage />); });
    // Should show spinner (not content)
    expect(document.body.textContent).not.toContain('Mint as NFT');
  });
});

describe('MintPage — unauthenticated redirect', () => {
  it('redirects to hub when not authenticated', async () => {
    mockUsePiAuth.mockReturnValue({
      user: null, isAuthenticated: false, isLoading: false,
      login: vi.fn(), logout: vi.fn(), error: null,
    });
    (window as unknown as Record<string, unknown>).__TEC_PI_READY = true;

    await act(async () => { render(<MintPage />); });

    await waitFor(() => {
      expect(window.location.href).toContain('hub.tecosystem.app');
    });
  });
});

describe('MintPage — startMint: Pi not available', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).__TEC_PI_READY = true;
  });

  it('shows error when PiRuntime not available', async () => {
    mockPiRuntimeIsAvailable.mockReturnValue(false);

    await act(async () => { render(<MintPage />); });

    const mintBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('Mint as NFT'),
    );
    expect(mintBtn).toBeTruthy();
    await act(async () => { fireEvent.click(mintBtn!); });

    await waitFor(() => {
      expect(document.body.textContent).toContain('Open in Pi Browser');
    });
  });

  it('shows error when assetId or name is missing', async () => {
    mockSearchParamsGet.mockImplementation((key: string) => {
      // Return empty strings for asset_id and name
      const map: Record<string, string> = {
        asset_id: '', name: '', tier: 'Common', return_url: 'https://example.com',
      };
      return map[key] ?? null;
    });

    await act(async () => { render(<MintPage />); });

    const mintBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('Mint as NFT'),
    );
    if (mintBtn) {
      await act(async () => { fireEvent.click(mintBtn!); });
      await waitFor(() => {
        expect(document.body.textContent).toContain('Invalid mint request');
      });
    }
  });
});

describe('MintPage — startMint: lock not acquired', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).__TEC_PI_READY = true;
  });

  it('shows error when payment lock cannot be acquired', async () => {
    mockPiSessionAcquirePaymentLock.mockResolvedValue(false);

    await act(async () => { render(<MintPage />); });

    const mintBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('Mint as NFT'),
    );
    expect(mintBtn).toBeTruthy();
    await act(async () => { fireEvent.click(mintBtn!); });

    await waitFor(() => {
      expect(document.body.textContent).toContain('Payment already in progress');
    });
  });
});

describe('MintPage — startMint: ensurePiAuth fails', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).__TEC_PI_READY = true;
  });

  it('shows error when ensurePiAuth returns false', async () => {
    mockUsePiSdkReady.mockReturnValue({
      piReady: true, authReady: true, lastError: null,
      ensurePiAuth: vi.fn().mockResolvedValue(false),
    });

    await act(async () => { render(<MintPage />); });

    const mintBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('Mint as NFT'),
    );
    expect(mintBtn).toBeTruthy();
    await act(async () => { fireEvent.click(mintBtn!); });

    await waitFor(() => {
      expect(document.body.textContent).toContain('Pi auth failed');
    });
  });
});

describe('MintPage — startMint: Pi payment flow', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).__TEC_PI_READY = true;
  });

  it('shows auth → payment status progression', async () => {
    // createPayment never resolves (stuck in payment state)
    mockPiRuntimeCreatePayment.mockImplementation(() => {
      // Do nothing — payment hangs
    });

    const mockEnsurePiAuth = vi.fn().mockResolvedValue(true);
    mockUsePiSdkReady.mockReturnValue({
      piReady: true, authReady: true, lastError: null,
      ensurePiAuth: mockEnsurePiAuth,
    });

    await act(async () => { render(<MintPage />); });

    const mintBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('Mint as NFT'),
    );
    expect(mintBtn).toBeTruthy();
    await act(async () => { fireEvent.click(mintBtn!); });

    await waitFor(() => {
      expect(
        document.body.textContent.includes('Authenticating...') ||
        document.body.textContent.includes('Processing payment...')
      ).toBe(true);
    });
  });
});

describe('MintPage — error state UI', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).__TEC_PI_READY = true;
  });

  it('shows Try Again and Back to Assets in error state', async () => {
    mockPiRuntimeIsAvailable.mockReturnValue(false);

    await act(async () => { render(<MintPage />); });

    const mintBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('Mint as NFT'),
    );
    await act(async () => { fireEvent.click(mintBtn!); });

    await waitFor(() => {
      expect(document.body.textContent).toContain('Try Again');
      expect(document.body.textContent).toContain('Back to Assets');
    });
  });

  it('Try Again resets status to idle', async () => {
    mockPiRuntimeIsAvailable.mockReturnValue(false);

    await act(async () => { render(<MintPage />); });

    const mintBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('Mint as NFT'),
    );
    await act(async () => { fireEvent.click(mintBtn!); });

    await waitFor(() => {
      expect(document.body.textContent).toContain('Try Again');
    });

    // Now click Try Again
    const tryBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent === 'Try Again',
    );
    await act(async () => { fireEvent.click(tryBtn!); });

    await waitFor(() => {
      expect(document.body.textContent).not.toContain('Open in Pi Browser');
    });
  });

  it('Back to Assets navigates back', async () => {
    mockPiRuntimeIsAvailable.mockReturnValue(false);

    await act(async () => { render(<MintPage />); });

    const mintBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('Mint as NFT'),
    );
    await act(async () => { fireEvent.click(mintBtn!); });

    await waitFor(() => {
      expect(document.body.textContent).toContain('Back to Assets');
    });

    const backBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent === 'Back to Assets',
    );
    await act(async () => { fireEvent.click(backBtn!); });

    // location.href should be set
    expect(window.location.href).toContain('/api/auth/sso');
  });
});

describe('MintPage — Cancel button', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).__TEC_PI_READY = true;
  });

  it('clicking Cancel navigates back via sso redirect', async () => {
    await act(async () => { render(<MintPage />); });

    const cancelBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent === 'Cancel',
    );
    expect(cancelBtn).toBeTruthy();
    await act(async () => { fireEvent.click(cancelBtn!); });

    expect(window.location.href).toContain('/api/auth/sso');
  });
});

describe('MintPage — success state', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).__TEC_PI_READY = true;
  });

  it('shows minting status text during NFT mint', async () => {
    // Have createPayment call onReadyForServerCompletion which sets minting status
    const mockEnsurePiAuth = vi.fn().mockResolvedValue(true);
    mockUsePiSdkReady.mockReturnValue({
      piReady: true, authReady: true, lastError: null,
      ensurePiAuth: mockEnsurePiAuth,
    });

    // URL-routed mock — flow hits refresh, create, approve, complete, mint-as-nft
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('/api/payment/create')) {
        return { ok: true, json: async () => ({ data: { id: 'pay-1' } }) };
      }
      return { ok: true, json: async () => ({}) };
    }) as unknown as typeof fetch;

    // createPayment resolves via callbacks — simulate full flow
    mockPiRuntimeCreatePayment.mockImplementation(
      (_config: unknown, callbacks: {
        onReadyForServerApproval: (id: string) => void;
        onReadyForServerCompletion: (id: string, txid: string) => void;
        onCancel: () => void;
        onError: (e: unknown) => void;
      }) => {
        // Call onReadyForServerApproval first
        Promise.resolve().then(() => callbacks.onReadyForServerApproval('pi-pay-1'));
        // Then call completion
        Promise.resolve().then(() =>
          callbacks.onReadyForServerCompletion('pi-pay-1', 'txid-abc')
        );
      }
    );

    await act(async () => { render(<MintPage />); });

    const mintBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('Mint as NFT'),
    );
    await act(async () => { fireEvent.click(mintBtn!); });

    await waitFor(() => {
      expect(
        document.body.textContent.includes('Minted Successfully!') ||
        document.body.textContent.includes('Minting your NFT...')
      ).toBe(true);
    }, { timeout: 5000 });
  });
});

describe('MintPage — createPayment error callback', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).__TEC_PI_READY = true;
  });

  it('shows error when onError callback fires', async () => {
    const mockEnsurePiAuth = vi.fn().mockResolvedValue(true);
    mockUsePiSdkReady.mockReturnValue({
      piReady: true, authReady: true, lastError: null,
      ensurePiAuth: mockEnsurePiAuth,
    });

    mockPiRuntimeCreatePayment.mockImplementation(
      (_config: unknown, callbacks: {
        onError: (e: unknown) => void;
      }) => {
        Promise.resolve().then(() => callbacks.onError(new Error('Pi wallet error')));
      }
    );

    await act(async () => { render(<MintPage />); });

    const mintBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('Mint as NFT'),
    );
    await act(async () => { fireEvent.click(mintBtn!); });

    await waitFor(() => {
      expect(document.body.textContent).toContain('Pi wallet error');
    }, { timeout: 5000 });
  });
});

describe('MintPage — createPayment onCancel callback', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).__TEC_PI_READY = true;
  });

  it('navigates back when payment cancelled via onCancel', async () => {
    const mockEnsurePiAuth = vi.fn().mockResolvedValue(true);
    mockUsePiSdkReady.mockReturnValue({
      piReady: true, authReady: true, lastError: null,
      ensurePiAuth: mockEnsurePiAuth,
    });

    mockPiRuntimeCreatePayment.mockImplementation(
      (_config: unknown, callbacks: {
        onCancel: () => void;
      }) => {
        Promise.resolve().then(() => callbacks.onCancel());
      }
    );

    await act(async () => { render(<MintPage />); });

    const mintBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('Mint as NFT'),
    );
    await act(async () => { fireEvent.click(mintBtn!); });

    await waitFor(() => {
      // onCancel calls goBack → sets location.href
      expect(window.location.href).toContain('/api/auth/sso');
    }, { timeout: 5000 });
  });
});

describe('MintPage — approval failure', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).__TEC_PI_READY = true;
  });

  it('shows error when approval fetch fails', async () => {
    const mockEnsurePiAuth = vi.fn().mockResolvedValue(true);
    mockUsePiSdkReady.mockReturnValue({
      piReady: true, authReady: true, lastError: null,
      ensurePiAuth: mockEnsurePiAuth,
    });

    // URL-routed: approve fails, everything else succeeds
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('/api/payment/create')) {
        return { ok: true, json: async () => ({ data: { id: 'pay-1' } }) };
      }
      if (String(url).includes('/api/payment/approve')) {
        return { ok: false, json: async () => ({ message: 'Approval rejected' }) };
      }
      return { ok: true, json: async () => ({}) };
    }) as unknown as typeof fetch;

    mockPiRuntimeCreatePayment.mockImplementation(
      (_config: unknown, callbacks: {
        onReadyForServerApproval: (id: string) => Promise<void>;
      }) => {
        Promise.resolve().then(() => callbacks.onReadyForServerApproval('pi-pay-1'));
      }
    );

    await act(async () => { render(<MintPage />); });

    const mintBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('Mint as NFT'),
    );
    await act(async () => { fireEvent.click(mintBtn!); });

    await waitFor(() => {
      expect(document.body.textContent).toContain('Approval rejected');
    }, { timeout: 5000 });
  });
});

describe('MintPage — mint-as-nft failure', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).__TEC_PI_READY = true;
  });

  it('shows error when mint-as-nft fetch fails', async () => {
    const mockEnsurePiAuth = vi.fn().mockResolvedValue(true);
    mockUsePiSdkReady.mockReturnValue({
      piReady: true, authReady: true, lastError: null,
      ensurePiAuth: mockEnsurePiAuth,
    });

    // URL-routed: mint-as-nft fails, everything else succeeds
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('/api/payment/create')) {
        return { ok: true, json: async () => ({ data: { id: 'pay-1' } }) };
      }
      if (String(url).includes('/api/bff/assets/mint-as-nft')) {
        return { ok: false, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({}) };
    }) as unknown as typeof fetch;

    mockPiRuntimeCreatePayment.mockImplementation(
      (_config: unknown, callbacks: {
        onReadyForServerApproval: (id: string) => Promise<void>;
        onReadyForServerCompletion: (id: string, txid: string) => Promise<void>;
      }) => {
        Promise.resolve()
          .then(() => callbacks.onReadyForServerApproval('pi-pay-1'))
          .then(() => callbacks.onReadyForServerCompletion('pi-pay-1', 'txid-123'));
      }
    );

    await act(async () => { render(<MintPage />); });

    const mintBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('Mint as NFT'),
    );
    await act(async () => { fireEvent.click(mintBtn!); });

    await waitFor(() => {
      expect(document.body.textContent).toContain('Mint failed');
    }, { timeout: 5000 });
  });
});

describe('PaymentModal — double-click guard and Try Again recovery timer', () => {
  it('second Pay click while first is in-flight releases the lock and returns', async () => {
    let resolveGate!: (v: boolean) => void;
    // Only ONE gate call now — the mount effect no longer authenticates, so
    // the first `ensurePaymentsReady` in this test IS the first tap's.
    mockPiSessionEnsurePaymentsReady
      .mockImplementationOnce(() => new Promise<boolean>(r => { resolveGate = r; }));

    renderModal();
    await waitForReady();
    const payBtn = screen.getByText(/^Pay \d+π$/);
    fireEvent.click(payBtn);          // first click — hangs on gate
    await act(async () => {});
    fireEvent.click(payBtn);          // second click — hasStarted guard
    await act(async () => {});
    expect(mockPiSessionReleasePaymentLock).toHaveBeenCalled();

    await act(async () => { resolveGate(true); });
    await waitFor(() => expect(screen.getByText('Payment Successful!')).toBeTruthy());
  });

  it('Try Again re-enables Pay after the 2s recovery gate succeeds', async () => {
    mockCreateU2APayment.mockResolvedValueOnce({
      success: false, status: 'failed', message: 'flaky', amount: 5, memo: 'test',
    });
    renderModal();
    await clickPay();
    await waitFor(() => expect(screen.getByText('Payment Failed')).toBeTruthy());

    mockPiSessionEnsurePaymentsReady.mockResolvedValue(true);
    fireEvent.click(screen.getByText('Try Again'));

    // recovery setTimeout(2000) → ensurePaymentsReady → setIsReady(true)
    await waitFor(
      () => {
        const btn = screen.getByText(/^Pay \d+π$/) as HTMLButtonElement;
        expect(btn.disabled).toBe(false);
      },
      { timeout: 4000 },
    );
  }, 10000);
});

describe('PaymentModal — a failed tap can be retried', () => {
  it('re-enables Pay after a failed auth, and authenticates again on the next tap', async () => {
    // The old ladder retried by itself, on a timer, with a reset + reInit in
    // between — a second Pi.authenticate nobody asked for. The retry is the
    // user tapping again, which is the only kind of call a WebView will
    // actually answer.
    mockPiSessionEnsurePaymentsReady.mockResolvedValueOnce(false);
    mockPiSessionLastError.value = 'AUTH_FAILED';
    renderModal();
    await waitForReady();

    await act(async () => { fireEvent.click(screen.getByText(/^Pay \d+π$/)); });
    await waitFor(() => expect(screen.getByText(/Pi auth \(AUTH_FAILED\)/)).toBeTruthy());
    expect(mockPiSessionEnsurePaymentsReady).toHaveBeenCalledTimes(1);

    mockPiSessionLastError.value = null;
    mockPiSessionEnsurePaymentsReady.mockResolvedValue(true);
    mockCreateU2APayment.mockResolvedValue({
      success: true, status: 'completed', txid: 'tx-2', paymentId: 'pay-2',
      amount: 5, memo: 'test',
    });
    fireEvent.click(screen.getByText('Try Again'));

    await waitFor(
      () => {
        const btn = screen.getByText(/^Pay \d+π$/) as HTMLButtonElement;
        expect(btn.disabled).toBe(false);
      },
      { timeout: 4000 },
    );
  }, 10000);

  it('unmount before the SDK is ready stops further state updates', async () => {
    // The cancelled guard still matters — it now protects the SDK wait rather
    // than an auth ladder.
    const { unmount } = renderModal();
    unmount();
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    expect(mockPiSessionEnsurePaymentsReady).not.toHaveBeenCalled();
  }, 8000);
});
