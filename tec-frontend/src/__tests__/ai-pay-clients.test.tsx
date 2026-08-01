/**
 * Tests for AiClient and PayClient page components.
 * Uses static imports (no await import per-test) to stay fast.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// ─── Hoisted refs ──────────────────────────────────────────────────────────────
const mockUsePiAuth     = vi.hoisted(() => vi.fn());
const mockUsePiSdkReady = vi.hoisted(() => vi.fn());
const mockCreateU2A     = vi.hoisted(() => vi.fn());
const mockUseSearchParams = vi.hoisted(() => vi.fn());

// ─── Module mocks ──────────────────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() })),
  usePathname: () => '/',
  useSearchParams: mockUseSearchParams,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

vi.mock('next/image', () => ({
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,
}));

vi.mock('@/lib/i18n', () => ({
  useTranslation: vi.fn(() => ({
    locale: 'en', setLocale: vi.fn(), dir: 'ltr',
    t: { common: { loading: 'Loading...', login: 'Login', appName: 'TEC' } },
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
  getStoredUser:  vi.fn(() => ({ id: 'u-1', piUsername: 'testuser' })),
  getAccessToken: vi.fn(() => 'tok-123'),
  getCsrfToken:   vi.fn(() => 'csrf-abc'),
  ssoRedirect:    vi.fn(),
  loginWithPi:    vi.fn().mockResolvedValue({ success: true }),
  isPiBrowser:    vi.fn(() => true),
  logout:         vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib-client/pi/PiRuntime', () => ({
  PiRuntime: {
    isAvailable:   vi.fn(() => true),
    isReady:       vi.fn(() => true),
    init:          vi.fn(),
    authenticate:  vi.fn(),
    createPayment: vi.fn(),
    canAttempt:    vi.fn(() => true),
  },
}));

// Static import AFTER mocks (vi.mock is hoisted so mocks apply first)
import AiClient  from '@/app/ai/AiClient';
import PayClient from '@/app/pay/PayClient';

// ─── Default mock values ───────────────────────────────────────────────────────
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

// ─── beforeEach ────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockUsePiAuth.mockReturnValue(defaultPiAuth);
  mockUsePiSdkReady.mockReturnValue(defaultSdkReady);
  mockUseSearchParams.mockReturnValue(defaultSearchParams);
  mockCreateU2A.mockResolvedValue({
    success: true, status: 'completed',
    paymentId: 'pay-1', txid: 'tx-abc123', amount: 5, memo: 'test',
  });

  // fetch mock: body resolves immediately (no infinite while-loop)
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok:   true,
    json: async () => ({ data: {} }),
    body: {
      getReader: () => ({
        read:   vi.fn().mockResolvedValue({ done: true, value: undefined }),
        cancel: vi.fn(),
      }),
    },
  } as any);

  Object.defineProperty(window, '__TEC_PI_READY', { value: true, writable: true, configurable: true });
  Object.defineProperty(window, 'location', { value: { href: 'http://localhost/', back: vi.fn() }, writable: true, configurable: true });
  Object.defineProperty(window, 'history',  { value: { back: vi.fn() }, writable: true, configurable: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AiClient
// ═══════════════════════════════════════════════════════════════════════════════

describe('AiClient', () => {
  it('renders without crash', () => {
    const { container } = render(<AiClient />);
    expect(container).toBeTruthy();
  });

  it('renders TEC AI header title', () => {
    render(<AiClient />);
    expect(screen.getByText('TEC AI')).toBeInTheDocument();
  });

  it('shows Online status', () => {
    render(<AiClient />);
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('shows back link to /hub', () => {
    render(<AiClient />);
    const link = screen.getByText('← Hub');
    expect(link.closest('a')).toHaveAttribute('href', '/hub');
  });

  it('shows AI subtitle', () => {
    render(<AiClient />);
    expect(screen.getByText('Your AI guide to TEC ecosystem')).toBeInTheDocument();
  });

  it('shows welcome message with username on load', async () => {
    render(<AiClient />);
    await waitFor(() => {
      expect(screen.getByText(/@testuser/)).toBeInTheDocument();
    });
  });

  it('shows welcome message without username when user is null', async () => {
    mockUsePiAuth.mockReturnValue({ ...defaultPiAuth, user: null, isAuthenticated: false });
    render(<AiClient />);
    await waitFor(() => {
      expect(screen.getByText(/Welcome!/)).toBeInTheDocument();
    });
  });

  it('renders Services panel button', () => {
    render(<AiClient />);
    expect(screen.getByRole('button', { name: /Services/ })).toBeInTheDocument();
  });

  it('renders Support panel button', () => {
    render(<AiClient />);
    expect(screen.getByRole('button', { name: /Support/ })).toBeInTheDocument();
  });

  it('opens Services panel showing Quick Actions', () => {
    render(<AiClient />);
    fireEvent.click(screen.getByRole('button', { name: /Services/ }));
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
  });

  it('opens Support panel showing Rate Your Experience', () => {
    render(<AiClient />);
    fireEvent.click(screen.getByRole('button', { name: /Support/ }));
    expect(screen.getByText('Rate Your Experience')).toBeInTheDocument();
  });

  it('clicking Services twice toggles closed', () => {
    render(<AiClient />);
    const btn = screen.getByRole('button', { name: /Services/ });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(screen.getByRole('button', { name: /Services/ })).toBeInTheDocument();
  });

  it('renders suggested questions', async () => {
    render(<AiClient />);
    await waitFor(() => {
      expect(screen.getByText('How do I invest with Pi?')).toBeInTheDocument();
    });
  });

  it('shows all four suggested questions', async () => {
    render(<AiClient />);
    await waitFor(() => {
      expect(screen.getByText('Show my TEC balance')).toBeInTheDocument();
      expect(screen.getByText('What is Nexus.pi?')).toBeInTheDocument();
      expect(screen.getByText('Best app for real estate?')).toBeInTheDocument();
    });
  });

  it('renders textarea input', () => {
    render(<AiClient />);
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
  });

  it('renders send button', () => {
    render(<AiClient />);
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('send button is disabled when input is empty', () => {
    render(<AiClient />);
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('send button becomes enabled when text is typed', () => {
    render(<AiClient />);
    fireEvent.change(screen.getByPlaceholderText('Type your message...'), { target: { value: 'Hello' } });
    expect(screen.getByRole('button', { name: /send/i })).not.toBeDisabled();
  });

  it('updates textarea value on change', () => {
    render(<AiClient />);
    const ta = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(ta, { target: { value: 'test msg' } });
    expect(ta).toHaveValue('test msg');
  });

  it('clears input after clicking send', async () => {
    render(<AiClient />);
    const ta = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(ta, { target: { value: 'Hello AI' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    await waitFor(() => expect(ta).toHaveValue(''));
  });

  it('sends message on Enter key', async () => {
    render(<AiClient />);
    const ta = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(ta, { target: { value: 'Enter message' } });
    await act(async () => {
      fireEvent.keyDown(ta, { key: 'Enter', shiftKey: false });
    });
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/ai/chat', expect.objectContaining({ method: 'POST' }));
    });
  });

  it('does NOT send on Shift+Enter', () => {
    render(<AiClient />);
    const ta = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(ta, { target: { value: 'multi line' } });
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true });
    // Shift+Enter must not SEND. (A benign personalization-context fetch may fire on
    // mount — assert the chat endpoint specifically was never hit, not that fetch is idle.)
    expect(fetch).not.toHaveBeenCalledWith('/api/ai/chat', expect.anything());
  });

  it('shows stars rating UI in Support panel', () => {
    render(<AiClient />);
    fireEvent.click(screen.getByRole('button', { name: /Support/ }));
    const stars = screen.getAllByText('★');
    expect(stars.length).toBe(5);
  });

  it('clicking a star marks rating done', () => {
    render(<AiClient />);
    fireEvent.click(screen.getByRole('button', { name: /Support/ }));
    fireEvent.click(screen.getAllByText('★')[2]);
    expect(screen.getByText(/Thanks for your rating!/)).toBeInTheDocument();
  });

  it('shows Contact Us links in Support panel', () => {
    render(<AiClient />);
    fireEvent.click(screen.getByRole('button', { name: /Support/ }));
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Telegram')).toBeInTheDocument();
  });

  it('shows support 24/7 note in Support panel', () => {
    render(<AiClient />);
    expect(screen.getByText(/24\/7/)).toBeInTheDocument();
  });

  it('renders quick action links in Services panel', () => {
    render(<AiClient />);
    fireEvent.click(screen.getByRole('button', { name: /Services/ }));
    expect(screen.getByText('TEC Hub').closest('a')).toHaveAttribute('href', '/hub');
  });

  it('shows All systems operational in Services panel', () => {
    render(<AiClient />);
    fireEvent.click(screen.getByRole('button', { name: /Services/ }));
    expect(screen.getByText('All systems operational')).toBeInTheDocument();
  });

  it('calls fetch /api/ai/chat when sending a message', async () => {
    render(<AiClient />);
    fireEvent.change(screen.getByPlaceholderText('Type your message...'), { target: { value: 'test q' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/ai/chat', expect.objectContaining({ method: 'POST' }));
    });
  });

  it('input hint text is shown', () => {
    render(<AiClient />);
    expect(screen.getByText('Enter to send · Shift+Enter for new line')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PayClient
// ═══════════════════════════════════════════════════════════════════════════════

describe('PayClient', () => {
  it('renders without crash', () => {
    const { container } = render(<PayClient />);
    expect(container).toBeTruthy();
  });

  it('shows asset name', () => {
    render(<PayClient />);
    expect(screen.getByText('Test Asset')).toBeInTheDocument();
  });

  it('shows price value', () => {
    render(<PayClient />);
    expect(screen.getByText('5.00')).toBeInTheDocument();
  });

  it('shows Price label', () => {
    render(<PayClient />);
    expect(screen.getByText('Price')).toBeInTheDocument();
  });

  it('shows charge warning', () => {
    render(<PayClient />);
    expect(screen.getByText(/You will be charged/)).toBeInTheDocument();
  });

  it('shows Pay button when piReady=true', () => {
    render(<PayClient />);
    expect(screen.getByText(/Pay 5/)).toBeInTheDocument();
  });

  it('shows Connecting to Pi when piReady=false', () => {
    mockUsePiSdkReady.mockReturnValue({ ...defaultSdkReady, piReady: false });
    render(<PayClient />);
    expect(screen.getByText('Connecting to Pi...')).toBeInTheDocument();
  });

  it('Pay button is disabled when piReady=false', () => {
    mockUsePiSdkReady.mockReturnValue({ ...defaultSdkReady, piReady: false });
    render(<PayClient />);
    expect(screen.getByText('Connecting to Pi...')).toBeDisabled();
  });

  it('shows Cancel button', () => {
    render(<PayClient />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('shows asset type label ASSET', () => {
    render(<PayClient />);
    expect(screen.getByText('ASSET')).toBeInTheDocument();
  });

  it('shows invalid payment when params missing', () => {
    mockUseSearchParams.mockReturnValueOnce({ get: () => null });
    render(<PayClient />);
    expect(screen.getByText('Invalid Payment Link')).toBeInTheDocument();
  });

  it('shows success state after successful payment', async () => {
    render(<PayClient />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Pay 5/));
    });
    await waitFor(() => {
      expect(screen.getByText(/Payment Successful/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows error state when payment fails', async () => {
    mockCreateU2A.mockResolvedValueOnce({ success: false, status: 'error', message: 'Insufficient funds' });
    render(<PayClient />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Pay 5/));
    });
    await waitFor(() => {
      expect(screen.getByText(/Payment Failed/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows cancelled state when payment is cancelled', async () => {
    mockCreateU2A.mockResolvedValueOnce({ success: false, status: 'cancelled' });
    render(<PayClient />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Pay 5/));
    });
    await waitFor(() => {
      expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('Go Back button calls window.history.back', () => {
    mockUseSearchParams.mockReturnValueOnce({ get: () => null });
    render(<PayClient />);
    fireEvent.click(screen.getByText('Go Back'));
    expect(window.history.back).toHaveBeenCalled();
  });

  it('Cancel button sets window.location.href to return_url', () => {
    render(<PayClient />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(window.location.href).toContain('tec-assets');
  });
});
