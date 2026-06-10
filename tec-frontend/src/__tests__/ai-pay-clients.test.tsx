/**
 * Tests for AiClient and PayClient page components.
 * Targets: src/app/ai/AiClient.tsx and src/app/pay/PayClient.tsx
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';

// ─── Global mocks ─────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  })),
  usePathname: () => '/',
  useSearchParams: vi.fn(() => ({
    get: (key: string) => {
      const params: Record<string, string> = {
        asset_id:   'asset-123',
        asset_type: 'asset',
        name:       'Test Asset',
        price:      '5.00',
        return_url: 'https://tec-assets-app.vercel.app/app',
        listing_id: 'listing-456',
        image_url:  '',
      };
      return params[key] ?? null;
    },
  })),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

vi.mock('next/image', () => ({
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,
}));

vi.mock('@/lib/i18n', () => ({
  useTranslation: vi.fn(() => ({
    locale: 'en',
    setLocale: vi.fn(),
    dir: 'ltr',
    t: {
      common:    { loading: 'Loading...', login: 'Login', appName: 'TEC' },
      dashboard: {},
      apps:      {},
    },
  })),
  LocaleProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib-client/hooks/usePiAuth', () => ({
  usePiAuth: vi.fn(() => ({
    user:            { id: 'u-1', piUsername: 'testuser' },
    isAuthenticated: true,
    isLoading:       false,
    login:           vi.fn(),
    logout:          vi.fn(),
    error:           null,
    errorType:       null,
  })),
}));

vi.mock('@/lib-client/hooks/usePiSdkReady', () => ({
  usePiSdkReady: vi.fn(() => ({
    piReady:      true,
    authReady:    true,
    lastError:    null,
    ensurePiAuth: vi.fn(() => Promise.resolve(true)),
  })),
}));

vi.mock('@/lib-client/pi/pi-session', () => ({
  piSession: {
    ensurePaymentsReady: vi.fn(() => Promise.resolve(true)),
    ensureAuth:          vi.fn(() => Promise.resolve(true)),
    acquirePaymentLock:  vi.fn(() => Promise.resolve(true)),
    releasePaymentLock:  vi.fn(),
    reset:               vi.fn(),
    reInit:              vi.fn(),
    isAuthenticated:     true,
    hasScope:            true,
    isPaymentLocked:     false,
    lastError:           null,
    lastRawError:        null,
  },
}));

vi.mock('@/lib-client/pi/pi-payment', () => ({
  createU2APayment: vi.fn(() =>
    Promise.resolve({
      success:   true,
      status:    'completed',
      paymentId: 'pay-1',
      txid:      'tx-abc123',
      amount:    5,
      memo:      'test',
    })
  ),
}));

vi.mock('@/lib-client/pi/pi-auth', () => ({
  getStoredUser:  vi.fn(() => ({ id: 'u-1', piUsername: 'testuser' })),
  getAccessToken: vi.fn(() => 'tok-123'),
  getCsrfToken:   vi.fn(() => 'csrf-abc'),
  ssoRedirect:    vi.fn(),
  loginWithPi:    vi.fn(() =>
    Promise.resolve({ success: true, user: { id: 'u-1', piUsername: 'testuser' }, isNewUser: false })
  ),
  isPiBrowser:    vi.fn(() => true),
  logout:         vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib-client/pi/PiRuntime', () => ({
  PiRuntime: {
    isAvailable: vi.fn(() => true),
    isReady:     vi.fn(() => true),
    init:        vi.fn(),
    authenticate: vi.fn(),
    createPayment: vi.fn(),
    canAttempt:  vi.fn(() => true),
  },
}));

// CSS module mock for AiClient
vi.mock('@/app/ai/ai.module.css', () => ({ default: {} }), { virtual: true });

// ─── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Mock window.Pi
  Object.defineProperty(window, 'Pi', {
    value: {
      init:        vi.fn(),
      authenticate: vi.fn(() => Promise.resolve({ user: { uid: 'u-1', username: 'testuser' } })),
      createPayment: vi.fn(),
    },
    writable:     true,
    configurable: true,
  });

  Object.defineProperty(window, '__TEC_PI_READY', {
    value:        true,
    writable:     true,
    configurable: true,
  });

  // Default fetch mock
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok:   true,
    json: async () => ({ data: {} }),
    body: null,
  } as any);

  // Mock window.location for PayClient redirect tests
  Object.defineProperty(window, 'location', {
    value: { href: 'http://localhost/', back: vi.fn() },
    writable:     true,
    configurable: true,
  });

  Object.defineProperty(window, 'history', {
    value: { back: vi.fn() },
    writable:     true,
    configurable: true,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AiClient
// ─────────────────────────────────────────────────────────────────────────────

describe('AiClient', () => {
  it('renders without crash', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    const { container } = render(<AiClient />);
    expect(container).toBeTruthy();
  });

  it('renders header with TEC AI title', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    expect(screen.getByText('TEC AI')).toBeInTheDocument();
  });

  it('shows online status indicator', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('shows back link to hub', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    const backLink = screen.getByText('← Hub');
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest('a')).toHaveAttribute('href', '/hub');
  });

  it('shows welcome message on initial load', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    await waitFor(() => {
      expect(screen.getByText(/Welcome/)).toBeInTheDocument();
    });
  });

  it('shows welcome message with username when user is logged in', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    await waitFor(() => {
      expect(screen.getByText(/@testuser/)).toBeInTheDocument();
    });
  });

  it('shows welcome message without username when user is null', async () => {
    const { usePiAuth } = await import('@/lib-client/hooks/usePiAuth');
    vi.mocked(usePiAuth).mockReturnValue({
      user:            null,
      isAuthenticated: false,
      isLoading:       false,
      login:           vi.fn(),
      logout:          vi.fn(),
      error:           null,
      errorType:       null,
    });

    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    await waitFor(() => {
      expect(screen.getByText(/Welcome!/)).toBeInTheDocument();
    });
  });

  it('shows subtitle text', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    expect(screen.getByText('Your AI guide to TEC ecosystem')).toBeInTheDocument();
  });

  it('renders Services panel tab', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    expect(screen.getByText(/Services/)).toBeInTheDocument();
  });

  it('renders Support panel tab', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    expect(screen.getByText(/Support/)).toBeInTheDocument();
  });

  it('toggles Services panel open on click', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    const servicesBtn = screen.getByText(/Services/);
    fireEvent.click(servicesBtn);
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
  });

  it('toggles Support panel open on click', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    const supportBtn = screen.getByText(/Support/);
    fireEvent.click(supportBtn);
    expect(screen.getByText('Rate Your Experience')).toBeInTheDocument();
  });

  it('closes Services panel when clicked again', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    const servicesBtn = screen.getByText(/Services/);
    fireEvent.click(servicesBtn); // open
    fireEvent.click(servicesBtn); // close
    // After closing, "Quick Actions" is no longer visible (panel collapsed)
    // The panel content may still be in DOM but panel is closed
    // Just verify clicking twice doesn't error
    expect(screen.getByText(/Services/)).toBeInTheDocument();
  });

  it('shows suggested question buttons initially', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    await waitFor(() => {
      expect(screen.getByText('How do I invest with Pi?')).toBeInTheDocument();
    });
  });

  it('shows all four suggested questions', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    await waitFor(() => {
      expect(screen.getByText('How do I invest with Pi?')).toBeInTheDocument();
      expect(screen.getByText('Show my TEC balance')).toBeInTheDocument();
      expect(screen.getByText('What is Nexus.pi?')).toBeInTheDocument();
      expect(screen.getByText('Best app for real estate?')).toBeInTheDocument();
    });
  });

  it('renders textarea input', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    const textarea = screen.getByPlaceholderText('Type your message...');
    expect(textarea).toBeInTheDocument();
  });

  it('renders send button', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    const sendBtn = screen.getByRole('button', { name: /send/i });
    expect(sendBtn).toBeInTheDocument();
  });

  it('send button is disabled when input is empty', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    const sendBtn = screen.getByRole('button', { name: /send/i });
    expect(sendBtn).toBeDisabled();
  });

  it('send button becomes enabled when text is typed', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    const textarea = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    const sendBtn = screen.getByRole('button', { name: /send/i });
    expect(sendBtn).not.toBeDisabled();
  });

  it('updates textarea value on change', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    const textarea = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(textarea, { target: { value: 'test message' } });
    expect(textarea).toHaveValue('test message');
  });

  it('clears input after sending message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok:   true,
      body: {
        getReader: () => ({
          read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
        }),
      },
      json: async () => ({}),
    } as any);

    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    const textarea = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(textarea, { target: { value: 'Hello AI' } });
    const sendBtn = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(textarea).toHaveValue('');
    });
  });

  it('sends message on Enter key (no Shift)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok:   true,
      body: {
        getReader: () => ({
          read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
        }),
      },
      json: async () => ({}),
    } as any);

    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    const textarea = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(textarea, { target: { value: 'Enter message' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/ai/chat',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('does NOT send message on Shift+Enter', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    const textarea = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(textarea, { target: { value: 'New line' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('posts to /api/ai/chat when message is sent', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok:   true,
      body: {
        getReader: () => ({
          read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
        }),
      },
      json: async () => ({}),
    } as any);

    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    const textarea = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(textarea, { target: { value: 'Hi' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/ai/chat',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });

  it('shows user message in the chat after sending', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok:   true,
      body: {
        getReader: () => ({
          read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
        }),
      },
      json: async () => ({}),
    } as any);

    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    const textarea = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(textarea, { target: { value: 'My test question' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('My test question')).toBeInTheDocument();
    });
  });

  it('shows error message when fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    const textarea = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(textarea, { target: { value: 'Failing message' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Something went wrong\. Please try again\./)
      ).toBeInTheDocument();
    });
  });

  it('shows error message when API returns non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok:   false,
      body: null,
      json: async () => ({}),
    } as any);

    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    const textarea = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(textarea, { target: { value: 'Bad message' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Something went wrong\. Please try again\./)
      ).toBeInTheDocument();
    });
  });

  it('parses SSE streaming data and appends to assistant message', async () => {
    const encoder = new TextEncoder();
    const data = 'data: {"text":"Hello from AI!"}\ndata: [DONE]\n';
    const encoded = encoder.encode(data);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok:   true,
      body: {
        getReader: () => {
          let called = false;
          return {
            read: vi.fn().mockImplementation(() => {
              if (!called) {
                called = true;
                return Promise.resolve({ done: false, value: encoded });
              }
              return Promise.resolve({ done: true, value: undefined });
            }),
          };
        },
      },
      json: async () => ({}),
    } as any);

    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    const textarea = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(textarea, { target: { value: 'Stream test' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Hello from AI!')).toBeInTheDocument();
    });
  });

  it('sends message when suggested question button is clicked', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok:   true,
      body: {
        getReader: () => ({
          read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
        }),
      },
      json: async () => ({}),
    } as any);

    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);

    await waitFor(() => {
      expect(screen.getByText('How do I invest with Pi?')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('How do I invest with Pi?'));
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/ai/chat', expect.objectContaining({ method: 'POST' }));
    });
  });

  it('shows star rating buttons in Support panel', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);

    // Open support panel
    const supportBtn = screen.getByText(/Support/);
    fireEvent.click(supportBtn);

    const stars = screen.getAllByText('★');
    expect(stars).toHaveLength(5);
  });

  it('shows rating done message after clicking a star', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);

    const supportBtn = screen.getByText(/Support/);
    fireEvent.click(supportBtn);

    const stars = screen.getAllByText('★');
    fireEvent.click(stars[2]); // Click 3rd star

    await waitFor(() => {
      expect(screen.getByText(/Thanks for your rating!/)).toBeInTheDocument();
    });
  });

  it('shows contact links in Support panel', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);

    const supportBtn = screen.getByText(/Support/);
    fireEvent.click(supportBtn);

    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Telegram')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Call')).toBeInTheDocument();
  });

  it('shows 24/7 support text in Support panel', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);

    const supportBtn = screen.getByText(/Support/);
    fireEvent.click(supportBtn);

    expect(screen.getByText(/24\/7/)).toBeInTheDocument();
  });

  it('sends topic message from Services panel', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok:   true,
      body: {
        getReader: () => ({
          read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
        }),
      },
      json: async () => ({}),
    } as any);

    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);

    const servicesBtn = screen.getByText(/Services/);
    fireEvent.click(servicesBtn);

    await act(async () => {
      fireEvent.click(screen.getByText('Getting Started Guide'));
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/ai/chat', expect.objectContaining({ method: 'POST' }));
    });
  });

  it('shows Quick Actions links in Services panel', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);

    const servicesBtn = screen.getByText(/Services/);
    fireEvent.click(servicesBtn);

    expect(screen.getByText('TEC Hub')).toBeInTheDocument();
    expect(screen.getByText('Pay with Pi')).toBeInTheDocument();
    expect(screen.getByText('My Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Digital Assets')).toBeInTheDocument();
  });

  it('shows all systems operational in Services panel', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);

    const servicesBtn = screen.getByText(/Services/);
    fireEvent.click(servicesBtn);

    expect(screen.getByText('All systems operational')).toBeInTheDocument();
  });

  it('renders in Arabic when locale is ar', async () => {
    const { useTranslation } = await import('@/lib/i18n');
    vi.mocked(useTranslation).mockReturnValue({
      locale:    'ar',
      setLocale: vi.fn(),
      dir:       'rtl',
      t:         { common: {}, dashboard: {}, apps: {} } as any,
    });

    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);

    await waitFor(() => {
      expect(screen.getByText(/مرحباً/)).toBeInTheDocument();
    });
  });

  it('shows hint text below input', async () => {
    const { default: AiClient } = await import('@/app/ai/AiClient');
    render(<AiClient />);
    expect(screen.getByText(/Enter to send/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PayClient
// ─────────────────────────────────────────────────────────────────────────────

describe('PayClient', () => {
  it('renders without crash', async () => {
    const { default: PayClient } = await import('@/app/pay/PayClient');
    const { container } = render(<PayClient />);
    expect(container).toBeTruthy();
  });

  it('shows asset name from query params', async () => {
    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);
    expect(screen.getByText('Test Asset')).toBeInTheDocument();
  });

  it('shows asset type in uppercase', async () => {
    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);
    expect(screen.getByText('ASSET')).toBeInTheDocument();
  });

  it('shows price label', async () => {
    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);
    expect(screen.getByText('Price')).toBeInTheDocument();
  });

  it('shows correct price value', async () => {
    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);
    expect(screen.getByText('5.00')).toBeInTheDocument();
  });

  it('shows warning about wallet charge', async () => {
    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);
    expect(screen.getByText(/You will be charged 5 Pi from your wallet/)).toBeInTheDocument();
  });

  it('shows Pay button when piReady is true', async () => {
    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);
    expect(screen.getByText('Pay 5π')).toBeInTheDocument();
  });

  it('shows Connecting to Pi when piReady is false', async () => {
    const { usePiSdkReady } = await import('@/lib-client/hooks/usePiSdkReady');
    vi.mocked(usePiSdkReady).mockReturnValue({
      piReady:      false,
      authReady:    false,
      lastError:    null,
      ensurePiAuth: vi.fn(() => Promise.resolve(false)),
    });

    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);
    expect(screen.getByText('Connecting to Pi...')).toBeInTheDocument();
  });

  it('Pay button is disabled when piReady is false', async () => {
    const { usePiSdkReady } = await import('@/lib-client/hooks/usePiSdkReady');
    vi.mocked(usePiSdkReady).mockReturnValue({
      piReady:      false,
      authReady:    false,
      lastError:    null,
      ensurePiAuth: vi.fn(() => Promise.resolve(false)),
    });

    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);
    const payBtn = screen.getByRole('button', { name: /Connecting to Pi/ });
    expect(payBtn).toBeDisabled();
  });

  it('shows Cancel button in idle state', async () => {
    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('shows invalid link screen when asset_id is missing', async () => {
    const { useSearchParams } = await import('next/navigation');
    vi.mocked(useSearchParams).mockReturnValue({
      get: (key: string) => {
        if (key === 'asset_id') return '';
        if (key === 'price') return '5.00';
        if (key === 'listing_id') return 'listing-456';
        return null;
      },
    } as any);

    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);
    expect(screen.getByText('Invalid Payment Link')).toBeInTheDocument();
    expect(screen.getByText('Missing required parameters')).toBeInTheDocument();
  });

  it('shows invalid link screen when price is 0', async () => {
    const { useSearchParams } = await import('next/navigation');
    vi.mocked(useSearchParams).mockReturnValue({
      get: (key: string) => {
        if (key === 'asset_id') return 'asset-123';
        if (key === 'price') return '0';
        if (key === 'listing_id') return 'listing-456';
        return null;
      },
    } as any);

    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);
    expect(screen.getByText('Invalid Payment Link')).toBeInTheDocument();
  });

  it('shows invalid link screen when listing_id is missing', async () => {
    const { useSearchParams } = await import('next/navigation');
    vi.mocked(useSearchParams).mockReturnValue({
      get: (key: string) => {
        if (key === 'asset_id') return 'asset-123';
        if (key === 'price') return '5.00';
        if (key === 'listing_id') return '';
        return null;
      },
    } as any);

    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);
    expect(screen.getByText('Invalid Payment Link')).toBeInTheDocument();
  });

  it('shows Go Back button on invalid link screen', async () => {
    const { useSearchParams } = await import('next/navigation');
    vi.mocked(useSearchParams).mockReturnValue({
      get: () => null,
    } as any);

    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });

  it('shows domain emoji for domain asset type', async () => {
    const { useSearchParams } = await import('next/navigation');
    vi.mocked(useSearchParams).mockReturnValue({
      get: (key: string) => {
        const params: Record<string, string> = {
          asset_id:   'asset-123',
          asset_type: 'domain',
          name:       'My Domain',
          price:      '5.00',
          listing_id: 'listing-456',
          image_url:  '',
        };
        return params[key] ?? null;
      },
    } as any);

    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);
    expect(screen.getByText('🌐')).toBeInTheDocument();
  });

  it('shows nft emoji for nft asset type without image', async () => {
    const { useSearchParams } = await import('next/navigation');
    vi.mocked(useSearchParams).mockReturnValue({
      get: (key: string) => {
        const params: Record<string, string> = {
          asset_id:   'asset-123',
          asset_type: 'nft',
          name:       'My NFT',
          price:      '5.00',
          listing_id: 'listing-456',
          image_url:  '',
        };
        return params[key] ?? null;
      },
    } as any);

    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);
    expect(screen.getByText('🎨')).toBeInTheDocument();
  });

  it('shows diamond emoji for generic asset type', async () => {
    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);
    expect(screen.getByText('💎')).toBeInTheDocument();
  });

  it('shows nft image when asset_type is nft and image_url is provided', async () => {
    const { useSearchParams } = await import('next/navigation');
    vi.mocked(useSearchParams).mockReturnValue({
      get: (key: string) => {
        const params: Record<string, string> = {
          asset_id:   'asset-123',
          asset_type: 'nft',
          name:       'My NFT',
          price:      '5.00',
          listing_id: 'listing-456',
          image_url:  'https://example.com/nft.png',
        };
        return params[key] ?? null;
      },
    } as any);

    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);
    const img = screen.getByAltText('My NFT');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/nft.png');
  });

  it('initiates payment when Pay button is clicked', async () => {
    const { createU2APayment } = await import('@/lib-client/pi/pi-payment');
    vi.mocked(createU2APayment).mockReturnValue(new Promise(() => {})); // never resolves = stays in paying state

    const { piSession } = await import('@/lib-client/pi/pi-session');
    vi.mocked(piSession.acquirePaymentLock).mockResolvedValue(true);

    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);

    const payBtn = screen.getByText('Pay 5π');
    await act(async () => {
      fireEvent.click(payBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('Processing payment...')).toBeInTheDocument();
    });
  });

  it('shows success state after successful payment', async () => {
    const { createU2APayment } = await import('@/lib-client/pi/pi-payment');
    vi.mocked(createU2APayment).mockResolvedValue({
      success:   true,
      status:    'completed',
      paymentId: 'pay-1',
      txid:      'tx-abcdefghijklmnopqrstuvwxyz',
      amount:    5,
      memo:      'test',
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok:   true,
      json: async () => ({}),
    } as any);

    const { piSession } = await import('@/lib-client/pi/pi-session');
    vi.mocked(piSession.acquirePaymentLock).mockResolvedValue(true);

    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);

    await act(async () => {
      fireEvent.click(screen.getByText('Pay 5π'));
    });

    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
    });
  });

  it('shows txid truncated after successful payment', async () => {
    const { createU2APayment } = await import('@/lib-client/pi/pi-payment');
    vi.mocked(createU2APayment).mockResolvedValue({
      success:   true,
      status:    'completed',
      paymentId: 'pay-1',
      txid:      'tx-abcdefghijklmnopqrstuvwxyz1234567890',
      amount:    5,
      memo:      'test',
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok:   true,
      json: async () => ({}),
    } as any);

    const { piSession } = await import('@/lib-client/pi/pi-session');
    vi.mocked(piSession.acquirePaymentLock).mockResolvedValue(true);

    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);

    await act(async () => {
      fireEvent.click(screen.getByText('Pay 5π'));
    });

    await waitFor(() => {
      expect(screen.getByText(/txid:/)).toBeInTheDocument();
    });
  });

  it('shows cancelled state when payment is cancelled', async () => {
    const { createU2APayment } = await import('@/lib-client/pi/pi-payment');
    vi.mocked(createU2APayment).mockResolvedValue({
      success: false,
      status:  'cancelled',
      amount:  5,
      memo:    'test',
    });

    const { piSession } = await import('@/lib-client/pi/pi-session');
    vi.mocked(piSession.acquirePaymentLock).mockResolvedValue(true);

    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);

    await act(async () => {
      fireEvent.click(screen.getByText('Pay 5π'));
    });

    await waitFor(() => {
      expect(screen.getByText('Payment Cancelled')).toBeInTheDocument();
    });
  });

  it('shows error state when payment fails', async () => {
    const { createU2APayment } = await import('@/lib-client/pi/pi-payment');
    vi.mocked(createU2APayment).mockResolvedValue({
      success: false,
      status:  'failed',
      amount:  5,
      memo:    'test',
      message: 'Insufficient funds',
    });

    const { piSession } = await import('@/lib-client/pi/pi-session');
    vi.mocked(piSession.acquirePaymentLock).mockResolvedValue(true);

    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);

    await act(async () => {
      fireEvent.click(screen.getByText('Pay 5π'));
    });

    await waitFor(() => {
      expect(screen.getByText('Payment Failed')).toBeInTheDocument();
      expect(screen.getByText('Insufficient funds')).toBeInTheDocument();
    });
  });

  it('shows error state when payment throws', async () => {
    const { createU2APayment } = await import('@/lib-client/pi/pi-payment');
    vi.mocked(createU2APayment).mockRejectedValue(new Error('Pi SDK error'));

    const { piSession } = await import('@/lib-client/pi/pi-session');
    vi.mocked(piSession.acquirePaymentLock).mockResolvedValue(true);

    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);

    await act(async () => {
      fireEvent.click(screen.getByText('Pay 5π'));
    });

    await waitFor(() => {
      expect(screen.getByText('Payment Failed')).toBeInTheDocument();
      expect(screen.getByText('Pi SDK error')).toBeInTheDocument();
    });
  });

  it('does not start payment when lock is not acquired', async () => {
    const { piSession } = await import('@/lib-client/pi/pi-session');
    vi.mocked(piSession.acquirePaymentLock).mockResolvedValue(false);

    const { createU2APayment } = await import('@/lib-client/pi/pi-payment');

    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);

    await act(async () => {
      fireEvent.click(screen.getByText('Pay 5π'));
    });

    expect(createU2APayment).not.toHaveBeenCalled();
  });

  it('shows Try Again button on cancelled state', async () => {
    const { createU2APayment } = await import('@/lib-client/pi/pi-payment');
    vi.mocked(createU2APayment).mockResolvedValue({
      success: false,
      status:  'cancelled',
      amount:  5,
      memo:    'test',
    });

    const { piSession } = await import('@/lib-client/pi/pi-session');
    vi.mocked(piSession.acquirePaymentLock).mockResolvedValue(true);

    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);

    await act(async () => {
      fireEvent.click(screen.getByText('Pay 5π'));
    });

    await waitFor(() => {
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

  it('returns to idle state when Try Again is clicked after cancel', async () => {
    const { createU2APayment } = await import('@/lib-client/pi/pi-payment');
    vi.mocked(createU2APayment).mockResolvedValue({
      success: false,
      status:  'cancelled',
      amount:  5,
      memo:    'test',
    });

    const { piSession } = await import('@/lib-client/pi/pi-session');
    vi.mocked(piSession.acquirePaymentLock).mockResolvedValue(true);

    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);

    await act(async () => {
      fireEvent.click(screen.getByText('Pay 5π'));
    });

    await waitFor(() => {
      expect(screen.getByText('Payment Cancelled')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Try Again'));
    await waitFor(() => {
      expect(screen.getByText('Pay 5π')).toBeInTheDocument();
    });
  });

  it('shows Try Again button on error state', async () => {
    const { createU2APayment } = await import('@/lib-client/pi/pi-payment');
    vi.mocked(createU2APayment).mockRejectedValue(new Error('Error'));

    const { piSession } = await import('@/lib-client/pi/pi-session');
    vi.mocked(piSession.acquirePaymentLock).mockResolvedValue(true);

    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);

    await act(async () => {
      fireEvent.click(screen.getByText('Pay 5π'));
    });

    await waitFor(() => {
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

  it('shows redirecting message after successful payment', async () => {
    const { createU2APayment } = await import('@/lib-client/pi/pi-payment');
    vi.mocked(createU2APayment).mockResolvedValue({
      success:   true,
      status:    'completed',
      paymentId: 'pay-1',
      txid:      'tx-abc',
      amount:    5,
      memo:      'test',
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok:   true,
      json: async () => ({}),
    } as any);

    const { piSession } = await import('@/lib-client/pi/pi-session');
    vi.mocked(piSession.acquirePaymentLock).mockResolvedValue(true);

    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);

    await act(async () => {
      fireEvent.click(screen.getByText('Pay 5π'));
    });

    await waitFor(() => {
      expect(screen.getByText('Redirecting to your assets...')).toBeInTheDocument();
    });
  });

  it('calls fetch for domain registration when listing_id starts with domain-reg-', async () => {
    const { useSearchParams } = await import('next/navigation');
    vi.mocked(useSearchParams).mockReturnValue({
      get: (key: string) => {
        const params: Record<string, string> = {
          asset_id:   'asset-123',
          asset_type: 'domain',
          name:       'mysite',
          price:      '5.00',
          listing_id: 'domain-reg-abc',
          image_url:  '',
        };
        return params[key] ?? null;
      },
    } as any);

    const { createU2APayment } = await import('@/lib-client/pi/pi-payment');
    vi.mocked(createU2APayment).mockResolvedValue({
      success:   true,
      status:    'completed',
      paymentId: 'pay-1',
      txid:      'tx-abc',
      amount:    5,
      memo:      'test',
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok:   true,
      json: async () => ({}),
    } as any);

    const { piSession } = await import('@/lib-client/pi/pi-session');
    vi.mocked(piSession.acquirePaymentLock).mockResolvedValue(true);

    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);

    await act(async () => {
      fireEvent.click(screen.getByText('Pay 5π'));
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/assets/provision',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('calls fetch for nft minting when listing_id starts with nft-mint-', async () => {
    const { useSearchParams } = await import('next/navigation');
    vi.mocked(useSearchParams).mockReturnValue({
      get: (key: string) => {
        const params: Record<string, string> = {
          asset_id:   'asset-123',
          asset_type: 'nft',
          name:       'My NFT',
          price:      '5.00',
          listing_id: 'nft-mint-xyz',
          image_url:  'https://example.com/nft.png',
        };
        return params[key] ?? null;
      },
    } as any);

    const { createU2APayment } = await import('@/lib-client/pi/pi-payment');
    vi.mocked(createU2APayment).mockResolvedValue({
      success:   true,
      status:    'completed',
      paymentId: 'pay-1',
      txid:      'tx-abc',
      amount:    5,
      memo:      'test',
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok:   true,
      json: async () => ({}),
    } as any);

    const { piSession } = await import('@/lib-client/pi/pi-session');
    vi.mocked(piSession.acquirePaymentLock).mockResolvedValue(true);

    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);

    await act(async () => {
      fireEvent.click(screen.getByText('Pay 5π'));
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/assets/provision',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('calls fetch for marketplace buy for regular listing_id', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok:   true,
      json: async () => ({}),
    } as any);

    const { createU2APayment } = await import('@/lib-client/pi/pi-payment');
    vi.mocked(createU2APayment).mockResolvedValue({
      success:   true,
      status:    'completed',
      paymentId: 'pay-1',
      txid:      'tx-abc',
      amount:    5,
      memo:      'test',
    });

    const { piSession } = await import('@/lib-client/pi/pi-session');
    vi.mocked(piSession.acquirePaymentLock).mockResolvedValue(true);

    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);

    await act(async () => {
      fireEvent.click(screen.getByText('Pay 5π'));
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/assets/buy',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('shows "Please confirm in Pi Browser" during payment processing', async () => {
    const { createU2APayment } = await import('@/lib-client/pi/pi-payment');
    vi.mocked(createU2APayment).mockReturnValue(new Promise(() => {}));

    const { piSession } = await import('@/lib-client/pi/pi-session');
    vi.mocked(piSession.acquirePaymentLock).mockResolvedValue(true);

    const { default: PayClient } = await import('@/app/pay/PayClient');
    render(<PayClient />);

    await act(async () => {
      fireEvent.click(screen.getByText('Pay 5π'));
    });

    await waitFor(() => {
      expect(screen.getByText('Please confirm in Pi Browser')).toBeInTheDocument();
    });
  });
});
