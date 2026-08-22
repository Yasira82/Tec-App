/**
 * Smoke tests for components with 0% coverage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter:       () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname:     () => '/dashboard',
  useSearchParams: () => new URLSearchParams('amount=5&memo=Test&product_id=p1&return_url=https://commerce.tecosystem.app&source=commerce'),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,
}));

vi.mock('@/lib-client/hooks/usePiAuth', () => ({
  usePiAuth: () => ({
    user:            { id: 'u1', piUsername: 'alice', role: 'user', subscriptionPlan: 'Free' },
    isAuthenticated: true,
    isLoading:       false,
    login:           vi.fn(),
    logout:          vi.fn(),
    error:           null,
  }),
}));

vi.mock('@/lib-client/hooks/usePiSdkReady', () => ({
  usePiSdkReady: () => ({
    piReady:      false,
    authReady:    false,
    lastError:    null,
    ensurePiAuth: vi.fn().mockResolvedValue(false),
  }),
}));

vi.mock('@/lib-client/pi/pi-session', () => ({
  piSession: {
    ensureAuth:          vi.fn().mockResolvedValue(true),
    ensurePaymentsReady: vi.fn().mockResolvedValue(true),
    reset:               vi.fn(),
  },
  PiAuthError: {},
}));

vi.mock('@/lib-client/pi/pi-payment', () => ({
  createU2APayment:    vi.fn().mockResolvedValue({ success: true }),
  createPaymentRecord: vi.fn().mockResolvedValue('payment-id-1'),
}));

vi.mock('@/lib-client/pi/PiRuntime', () => ({
  PiRuntime: {
    init:          vi.fn(),
    authenticate:  vi.fn(),
    createPayment: vi.fn(),
    canAttempt:    vi.fn(() => true),
  },
}));

// Mock with the REAL `en` bundle: a partial stub silently drops whole UI branches
// (a missing t.dashboard.menu crashed the Sidebar), and a smoke test that renders
// less than production isn't smoke-testing production.
vi.mock('@/lib/i18n', async () => {
  const { en } = await import('@/lib/i18n/en');
  return {
    useTranslation: () => ({ t: en, locale: 'en', setLocale: vi.fn(), setLanguage: vi.fn(), dir: 'ltr' }),
    LocaleProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true, json: async () => ({}),
  }) as any;
});

// ── AIDrawer component ─────────────────────────────────────────────
describe('AIDrawer', () => {
  it('renders closed state', async () => {
    const { AIDrawer } = await import('@/app/hub/components/AIDrawer');
    const { container } = render(<AIDrawer open={false} onClose={vi.fn()} />);
    expect(container).toBeTruthy();
  });

  it('renders open state', async () => {
    const { AIDrawer } = await import('@/app/hub/components/AIDrawer');
    const { container } = render(<AIDrawer open={true} onClose={vi.fn()} />);
    expect(container).toBeTruthy();
  });
});

// ── HubSkeleton component ──────────────────────────────────────────
describe('HubSkeleton', () => {
  it('renders without crash', async () => {
    const { HubSkeleton } = await import('@/app/hub/components/HubSkeleton');
    const { container } = render(<HubSkeleton />);
    expect(container).toBeTruthy();
  });
});

// ── ToastContainer component ───────────────────────────────────────
describe('ToastContainer', () => {
  it('renders empty list', async () => {
    const { ToastContainer } = await import('@/app/hub/components/ToastContainer');
    const { container } = render(<ToastContainer toasts={[]} onRemove={vi.fn()} />);
    expect(container).toBeTruthy();
  });

  it('renders with toasts', async () => {
    const { ToastContainer } = await import('@/app/hub/components/ToastContainer');
    const { container } = render(
      <ToastContainer
        toasts={[{ id: '1', type: 'success', message: 'Done!' }]}
        onRemove={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });
});

// ── AiClient page — skipped: uses streaming SSE response ──────────
// AiClient uses response.body.getReader() for SSE streaming, which hangs in happy-dom.
// Coverage via integration test only.

// ── Dashboard Sidebar component ────────────────────────────────────
describe('Sidebar', () => {
  it('renders without crash', async () => {
    const { Sidebar } = await import('@/components/dashboard/Sidebar');
    const { container } = render(<Sidebar />);
    expect(container).toBeTruthy();
  });
});

// ── MobileTopbar component ─────────────────────────────────────────
describe('MobileTopbar', () => {
  it('renders without crash', async () => {
    const { MobileTopbar } = await import('@/components/dashboard/MobileTopbar');
    const { container } = render(<MobileTopbar />);
    expect(container).toBeTruthy();
  });
});

// ── PiSdkLoader component ──────────────────────────────────────────
describe('PiSdkLoader', () => {
  it('renders without crash', async () => {
    const mod = await import('@/components/PiSdkLoader');
    const Component = mod.PiSdkLoader ?? mod.default;
    if (!Component) return;
    const { container } = render(<Component />);
    expect(container).toBeTruthy();
  });
});

// ── PayClient — import-only coverage ──────────────────────────────
describe('PayClient module', () => {
  it('module loads without error', async () => {
    const mod = await import('@/app/pay/PayClient');
    expect(mod).toBeTruthy();
  });
});
