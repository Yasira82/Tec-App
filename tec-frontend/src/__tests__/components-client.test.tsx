/**
 * Smoke tests for client-side components with low/zero coverage:
 * PiTestClient, PiIntegration, PiPaymentButton, AIDrawer
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@/test-utils/render-with-locale';

// ── Hoisted mock refs (must come before vi.mock calls) ────────────
const mockUsePiAuthFn = vi.hoisted(() => vi.fn());

vi.mock('@/lib-client/pi/pi-auth', () => ({
  isPiBrowser:    vi.fn(() => false),
  loginWithPi:    vi.fn().mockResolvedValue({ uid: 'u1', username: 'alice' }),
  getStoredUser:  vi.fn(() => ({ id: 'u1', piUsername: 'alice' })),
  getAccessToken: vi.fn(() => 'tok'),
  logout:         vi.fn(),
}));

vi.mock('@/lib-client/pi/pi-payment', () => ({
  createU2APayment:    vi.fn().mockResolvedValue({ success: true }),
  createPaymentRecord: vi.fn().mockResolvedValue('pay-id'),
}));

vi.mock('@/lib-client/pi/PiRuntime', () => ({
  PiRuntime: {
    init:          vi.fn(),
    authenticate:  vi.fn(),
    createPayment: vi.fn(),
    canAttempt:    vi.fn(() => true),
    isReady:       vi.fn(() => false),
    isAvailable:   vi.fn(() => false),
  },
}));

vi.mock('@/lib-client/hooks/usePiAuth', () => ({
  usePiAuth: mockUsePiAuthFn,
}));

vi.mock('@/lib-client/hooks/usePiPayment', () => ({
  usePiPayment: () => ({
    isProcessing:  false,
    lastPayment:   null,
    error:         null,
    errorType:     null,
    testSDK:       vi.fn(),
    payDemoPi:     vi.fn().mockResolvedValue({ success: true }),
  }),
}));

// `@/lib/i18n` is deliberately NOT mocked — this stub carried a hand-written
// dictionary, so the assertions below were checking the stub's wording rather than
// the copy that ships. Tests render through the real provider instead.

const defaultAuthState = {
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
  mockUsePiAuthFn.mockReturnValue(defaultAuthState);
  global.fetch = vi.fn().mockResolvedValue({
    ok: true, json: async () => ({}),
  }) as any;
});

// ── PiTestClient ───────────────────────────────────────────────
describe('PiTestClient', () => {
  it('renders without crash', async () => {
    const { PiTestClient } = await import('@/app/pi-test/PiTestClient');
    const { container } = render(<PiTestClient />);
    expect(container).toBeTruthy();
  });

  it('shows initial idle state', async () => {
    const { PiTestClient } = await import('@/app/pi-test/PiTestClient');
    const { container } = render(<PiTestClient />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders with Pi ready flag set', async () => {
    (window as any).__TEC_PI_READY = true;
    const { PiTestClient } = await import('@/app/pi-test/PiTestClient');
    const { container } = render(<PiTestClient />);
    expect(container).toBeTruthy();
    (window as any).__TEC_PI_READY = undefined;
  });

  it('renders with Pi error flag set', async () => {
    (window as any).__TEC_PI_ERROR = true;
    const { PiTestClient } = await import('@/app/pi-test/PiTestClient');
    const { container } = render(<PiTestClient />);
    expect(container).toBeTruthy();
    (window as any).__TEC_PI_ERROR = undefined;
  });
});

// ── PiIntegration ──────────────────────────────────────────────
describe('PiIntegration', () => {
  it('renders without crash (authenticated)', async () => {
    const PiIntegration = (await import('@/components/PiIntegration')).default;
    const { container } = render(<PiIntegration />);
    expect(container).toBeTruthy();
  });

  it('renders in loading state', async () => {
    mockUsePiAuthFn.mockReturnValueOnce({
      user: null, isAuthenticated: false, isLoading: true,
      login: vi.fn(), logout: vi.fn(), error: null, errorType: null,
    });
    const PiIntegration = (await import('@/components/PiIntegration')).default;
    const { container } = render(<PiIntegration />);
    expect(container).toBeTruthy();
  });

  it('renders unauthenticated state', async () => {
    mockUsePiAuthFn.mockReturnValueOnce({
      user: null, isAuthenticated: false, isLoading: false,
      login: vi.fn(), logout: vi.fn(), error: null, errorType: null,
    });
    const PiIntegration = (await import('@/components/PiIntegration')).default;
    const { container } = render(<PiIntegration />);
    expect(container).toBeTruthy();
  });

  it('renders with auth error state', async () => {
    mockUsePiAuthFn.mockReturnValueOnce({
      user: null, isAuthenticated: false, isLoading: false,
      login: vi.fn(), logout: vi.fn(),
      error: 'Not Pi Browser', errorType: 'not_pi_browser',
    });
    const PiIntegration = (await import('@/components/PiIntegration')).default;
    const { container } = render(<PiIntegration />);
    expect(container).toBeTruthy();
  });
});

// ── PiPaymentButton ────────────────────────────────────────────
describe('PiPaymentButton', () => {
  it('renders without crash', async () => {
    const PiPaymentButton = (await import('@/components/payment/PiPaymentButton')).default;
    const { container } = render(<PiPaymentButton />);
    expect(container).toBeTruthy();
  });

  it('renders with Pi already ready', async () => {
    (window as any).__TEC_PI_READY = true;
    const PiPaymentButton = (await import('@/components/payment/PiPaymentButton')).default;
    const { container } = render(<PiPaymentButton />);
    expect(container).toBeTruthy();
    (window as any).__TEC_PI_READY = undefined;
  });
});

// ── AIDrawer (more coverage) ───────────────────────────────────
describe('AIDrawer coverage', () => {
  it('renders open state with chat UI', async () => {
    const { AIDrawer } = await import('@/app/hub/components/AIDrawer');
    await act(async () => {
      render(<AIDrawer open={true} onClose={vi.fn()} />);
    });
    expect(document.body).toBeTruthy();
  });

  it('renders closed state', async () => {
    const { AIDrawer } = await import('@/app/hub/components/AIDrawer');
    const { container } = render(<AIDrawer open={false} onClose={vi.fn()} />);
    expect(container).toBeTruthy();
  });
});
