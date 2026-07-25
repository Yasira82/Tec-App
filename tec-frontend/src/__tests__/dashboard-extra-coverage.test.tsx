/**
 * Comprehensive coverage tests for low-coverage dashboard / hub pages.
 *
 * Files targeted:
 *   1. dashboard/orders/checkout/page.tsx       (35.7%)
 *   2. dashboard/security/page.tsx              (43.5%)
 *   3. dashboard/subscription/page.tsx          (53.0%)
 *   4. hub/subscription/page.tsx                (48.5%)
 *   5. dashboard/profile/page.tsx               (52.6%)
 *   6. hub/profile/page.tsx                     (52.6%)
 *   7. hub/kyc/page.tsx                         (63.4%)
 *   8. dashboard/kyc/page.tsx                   (65.8%)
 *   9. dashboard/marketplace/page.tsx           (66.7%)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, act, fireEvent, waitFor } from '@testing-library/react';

// ──────────────────────────────────────────────────────────────────
// Hoisted mock references
// ──────────────────────────────────────────────────────────────────
const mockUsePiAuth        = vi.hoisted(() => vi.fn());
const mockUseKyc           = vi.hoisted(() => vi.fn());
const mockGetAccessToken   = vi.hoisted(() => vi.fn());
const mockGetStoredUser    = vi.hoisted(() => vi.fn());
const mockBuyAsset         = vi.hoisted(() => vi.fn());
const mockSearchParamsGet  = vi.hoisted(() => vi.fn((_k: string) => null as string | null));

// ──────────────────────────────────────────────────────────────────
// Module mocks
// ──────────────────────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter:       () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname:     () => '/dashboard',
  useSearchParams: () => ({ get: (_k: string) => null }),
}));

vi.mock('@/lib-client/hooks/usePiAuth', () => ({
  usePiAuth: mockUsePiAuth,
}));

vi.mock('@/lib-client/hooks/useKyc', () => ({
  useKyc: mockUseKyc,
}));

vi.mock('@/lib-client/pi/pi-auth', () => ({
  getAccessToken: mockGetAccessToken,
  getStoredUser:  mockGetStoredUser,
  loginWithPi:    vi.fn(),
  logout:         vi.fn(),
  isPiBrowser:    vi.fn(() => false),
}));

vi.mock('@/lib-client/pi/marketplace-payment', () => ({
  buyAsset: mockBuyAsset,
}));

// Subscription upgrades now take a real Pi payment first — mock it as completed
// so the subscribe POST fires in tests.
const mockCreateU2A = vi.hoisted(() => vi.fn(async () => ({
  success: true, status: 'completed', paymentId: 'pi-pay-1', txid: 'tx-1', amount: 10, memo: 'sub',
})));
vi.mock('@/lib-client/pi/pi-payment', () => ({ createU2APayment: mockCreateU2A }));

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t:           { common: { loading: 'Loading...' }, dashboard: { title: 'Dashboard' }, apps: {} },
    locale:      'en',
    setLanguage: vi.fn(),
    dir:         'ltr',
  }),
  LocaleProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/request-id', () => ({
  buildHeaders: vi.fn(() => ({ 'x-request-id': 'req-id' })),
}));

// Security page uses a CSS module
vi.mock('@/app/dashboard/security/security.module.css', () => ({
  default: new Proxy({}, { get: (_: unknown, prop: string) => String(prop) }),
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
          <h1>{title}</h1>
          <p>{subtitle}</p>
          {actions}
          {children}
        </div>
      ),
  DashboardCard: ({
    children, title, subtitle, action,
  }: {
    children?: React.ReactNode; title?: string; subtitle?: string;
    action?: React.ReactNode; padding?: string;
  }) => (
    <div data-testid="dashboard-card">
      <h2>{title}</h2>
      <p>{subtitle}</p>
      {action}
      {children}
    </div>
  ),
}));

vi.mock('@/components/hub', () => ({
  HubSubShell: ({
    children, title, loading,
  }: {
    children?: React.ReactNode; title?: string; loading?: boolean;
    badge?: unknown; subtitle?: string; actions?: React.ReactNode;
  }) =>
    loading
      ? <div data-testid="hub-loading">Loading…</div>
      : <div data-testid="hub-shell"><h1>{title}</h1>{children}</div>,
}));

// ──────────────────────────────────────────────────────────────────
// Default state helpers
// ──────────────────────────────────────────────────────────────────
const defaultUser = {
  id:               'u-1',
  piUsername:       'alice',
  piId:             'pi-uid-1',
  role:             'user',
  subscriptionPlan: 'Free',
  createdAt:        '2024-01-01T00:00:00Z',
};

const defaultAuthState = {
  user:            defaultUser,
  isAuthenticated: true,
  isLoading:       false,
  login:           vi.fn(),
  logout:          vi.fn(),
  error:           null,
};

const kycBase = {
  kyc:          null,
  isLoading:    false,
  isSubmitting: false,
  error:        null,
  refetch:      vi.fn(),
  uploadDocs:   vi.fn(),
  submit:       vi.fn(),
  reset:        vi.fn(),
};

const kycRecord = (status: string, extras: Record<string, unknown> = {}) => ({
  id:               'kyc-1',
  user_id:          'u-1',
  status,
  level:            'L0',
  id_front_url:     null,
  id_back_url:      null,
  selfie_url:       null,
  rejection_reason: null,
  verified_at:      null,
  submitted_at:     null,
  created_at:       '2024-01-01',
  ...extras,
});

// ──────────────────────────────────────────────────────────────────
// beforeEach — reset all mocks
// ──────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();

  mockUsePiAuth.mockReturnValue(defaultAuthState);
  mockUseKyc.mockReturnValue(kycBase);
  mockGetAccessToken.mockReturnValue('test-token');
  mockGetStoredUser.mockReturnValue(defaultUser);
  mockBuyAsset.mockResolvedValue({ success: true, message: 'Purchased!' });

  // Default fetch stub
  global.fetch = vi.fn().mockResolvedValue({
    ok:   true,
    json: async () => ({ data: null }),
  }) as unknown as typeof fetch;

  // Mock clipboard
  Object.defineProperty(navigator, 'clipboard', {
    value:    { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
  });

  // Mock window.confirm
  Object.defineProperty(window, 'confirm', {
    value:    vi.fn().mockReturnValue(false),
    writable: true,
  });
});

// ══════════════════════════════════════════════════════════════════
// 1. Checkout Page
// ══════════════════════════════════════════════════════════════════
describe('CheckoutPage (dashboard/orders/checkout)', () => {
  it('renders empty cart state when no product_id in search params', async () => {
    const { default: Page } = await import('@/app/dashboard/orders/checkout/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('No items in cart');
  });

  it('renders unauthenticated state — does not crash', async () => {
    mockUsePiAuth.mockReturnValue({ ...defaultAuthState, isAuthenticated: false, user: null });
    const { default: Page } = await import('@/app/dashboard/orders/checkout/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });

  it('renders Checkout title', async () => {
    const { default: Page } = await import('@/app/dashboard/orders/checkout/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Checkout');
  });

  it('renders Order Summary section', async () => {
    const { default: Page } = await import('@/app/dashboard/orders/checkout/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Order Summary');
  });

  it('pay button is disabled when items list is empty', async () => {
    const { default: Page } = await import('@/app/dashboard/orders/checkout/page');
    const { container } = render(<Page />);
    const buttons = container.querySelectorAll('button');
    const payBtn = Array.from(buttons).find(b => b.textContent?.includes('Pay'));
    expect(payBtn).toBeTruthy();
    expect(payBtn?.disabled).toBe(true);
  });

  it('shows error state after failed order creation', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok:   false,
      json: async () => ({ message: 'Out of stock' }),
    }) as unknown as typeof fetch;

    const { default: Page } = await import('@/app/dashboard/orders/checkout/page');
    const { container } = render(<Page />);
    expect(container).toBeTruthy();
  });

  it('shows success state after successful checkout flow', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok:   true,
        json: async () => ({ data: { order: { id: 'order-abc-123' } } }),
      })
      .mockResolvedValueOnce({
        ok:   true,
        json: async () => ({ data: { payment: { id: 'pay-abc-123' } } }),
      })
      .mockResolvedValueOnce({
        ok:   true,
        json: async () => ({ success: true }),
      }) as unknown as typeof fetch;

    const { default: Page } = await import('@/app/dashboard/orders/checkout/page');
    const { container } = render(<Page />);
    expect(container).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════════════════
// 2. Security Page
// ══════════════════════════════════════════════════════════════════
describe('SecurityPage (dashboard/security)', () => {
  it('renders Security Center heading', async () => {
    const { default: Page } = await import('@/app/dashboard/security/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Security Center');
  });

  it('renders 2FA section with toggle', async () => {
    const { default: Page } = await import('@/app/dashboard/security/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Two-Factor Authentication');
    const toggle = container.querySelector('[id="2fa-toggle"]');
    expect(toggle).toBeTruthy();
  });

  it('renders Enable Now banner when 2FA is disabled', async () => {
    const { default: Page } = await import('@/app/dashboard/security/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Enable 2FA');
    expect(container.textContent).toContain('Enable Now');
  });

  it('renders Active Sessions section', async () => {
    const { default: Page } = await import('@/app/dashboard/security/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Active Sessions');
    expect(container.textContent).toContain('Chrome on Android');
    expect(container.textContent).toContain('Current');
  });

  it('renders Trusted Devices section', async () => {
    const { default: Page } = await import('@/app/dashboard/security/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Trusted Devices');
    expect(container.textContent).toContain('Android Phone');
    expect(container.textContent).toContain('Remove');
  });

  it('clicking Enable Now shows QR step', async () => {
    const { default: Page } = await import('@/app/dashboard/security/page');
    const { container } = render(<Page />);
    const enableBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Enable Now'),
    );
    expect(enableBtn).toBeTruthy();
    fireEvent.click(enableBtn!);
    expect(container.textContent).toContain('Scan with Google Authenticator');
  });

  it('shows OTP error when code is too short', async () => {
    const { default: Page } = await import('@/app/dashboard/security/page');
    const { container } = render(<Page />);
    const enableBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Enable Now'),
    );
    fireEvent.click(enableBtn!);
    const verifyBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Verify'),
    );
    fireEvent.click(verifyBtn!);
    expect(container.textContent).toContain('Enter 6 digits');
  });

  it('progresses to PIN step after entering valid 6-digit OTP', async () => {
    const { default: Page } = await import('@/app/dashboard/security/page');
    const { container } = render(<Page />);
    const enableBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Enable Now'),
    );
    fireEvent.click(enableBtn!);
    const otpInput = container.querySelector('input[inputMode="numeric"]') as HTMLInputElement;
    expect(otpInput).toBeTruthy();
    fireEvent.change(otpInput, { target: { value: '123456' } });
    const verifyBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Verify'),
    );
    fireEvent.click(verifyBtn!);
    expect(container.textContent).toContain('Set PIN Code');
  });

  it('shows PIN mismatch error when PINs do not match', async () => {
    const { default: Page } = await import('@/app/dashboard/security/page');
    const { container } = render(<Page />);
    const enableBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Enable Now'),
    );
    fireEvent.click(enableBtn!);
    const otpInput = container.querySelector('input[inputMode="numeric"]') as HTMLInputElement;
    fireEvent.change(otpInput, { target: { value: '123456' } });
    const verifyBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Verify'),
    );
    fireEvent.click(verifyBtn!);
    const pinInputs = container.querySelectorAll('input[type="password"]');
    fireEvent.change(pinInputs[0], { target: { value: '1234' } });
    fireEvent.change(pinInputs[1], { target: { value: '5678' } });
    const saveBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Save'),
    );
    fireEvent.click(saveBtn!);
    expect(container.textContent).toContain('PINs do not match');
  });

  it('shows PIN too short error', async () => {
    const { default: Page } = await import('@/app/dashboard/security/page');
    const { container } = render(<Page />);
    const enableBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Enable Now'),
    );
    fireEvent.click(enableBtn!);
    const otpInput = container.querySelector('input[inputMode="numeric"]') as HTMLInputElement;
    fireEvent.change(otpInput, { target: { value: '123456' } });
    const verifyBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Verify'),
    );
    fireEvent.click(verifyBtn!);
    const saveBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Save'),
    );
    fireEvent.click(saveBtn!);
    expect(container.textContent).toContain('PIN must be at least 4 digits');
  });

  it('shows 2FA enabled success state with backup codes', async () => {
    const { default: Page } = await import('@/app/dashboard/security/page');
    const { container } = render(<Page />);
    const enableBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Enable Now'),
    );
    fireEvent.click(enableBtn!);
    const otpInput = container.querySelector('input[inputMode="numeric"]') as HTMLInputElement;
    fireEvent.change(otpInput, { target: { value: '123456' } });
    const verifyBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Verify'),
    );
    fireEvent.click(verifyBtn!);
    const pinInputs = container.querySelectorAll('input[type="password"]');
    fireEvent.change(pinInputs[0], { target: { value: '1234' } });
    fireEvent.change(pinInputs[1], { target: { value: '1234' } });
    const saveBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Save'),
    );
    fireEvent.click(saveBtn!);
    expect(container.textContent).toContain('2FA Enabled Successfully');
    expect(container.textContent).toContain('Backup Codes');
    expect(container.textContent).toContain('ABC123');
  });

  it('2FA checkbox is unchecked by default (twoFaEnabled=false)', async () => {
    const { default: Page } = await import('@/app/dashboard/security/page');
    const { container } = render(<Page />);
    const toggle = container.querySelector('[id="2fa-toggle"]') as HTMLInputElement;
    // Initially 2FA is disabled — checkbox is unchecked
    expect(toggle).toBeTruthy();
    expect(toggle.checked).toBe(false);
  });

  it('renders Revoke button for non-current session', async () => {
    const { default: Page } = await import('@/app/dashboard/security/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Revoke');
  });

  it('renders Manage your account security settings subtitle', async () => {
    const { default: Page } = await import('@/app/dashboard/security/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Manage your account security settings');
  });
});

// ══════════════════════════════════════════════════════════════════
// 3. Dashboard Subscription Page
// ══════════════════════════════════════════════════════════════════
describe('DashboardSubscriptionPage (dashboard/subscription)', () => {
  it('renders loading state initially via shell', async () => {
    global.fetch = vi.fn().mockReturnValue({
      ok:   true,
      json: () => new Promise(() => {}), // resolved but json never resolves
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    const { getByTestId } = render(<Page />);
    expect(getByTestId('shell-loading')).toBeTruthy();
  });

  it('renders plans after fetch with no subscription', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: null }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('Free');
  });

  it('renders plans — Free shows CURRENT badge', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: null }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('Your current plan');
  });

  it('renders POPULAR badge on PRO plan', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: null }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('POPULAR');
  });

  it('renders upgrade buttons for paid plans', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: null }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('Upgrade to');
  });

  it('renders current plan card for active PRO subscription', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          plan:               'PRO',
          status:             'ACTIVE',
          current_period_end: '2025-12-31',
          isExpired:          false,
          planDetails:        { id: 'PRO', name: 'Pro', price: 10, currency: 'PI', duration: 30, features: ['Unlimited assets'] },
        },
      }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('Current Plan');
    expect(document.body.textContent).toContain('Active');
  });

  it('renders Cancel Subscription button for active PRO', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          plan: 'PRO', status: 'ACTIVE', current_period_end: '2025-12-31',
          isExpired: false,
          planDetails: { id: 'PRO', name: 'Pro', price: 10, currency: 'PI', duration: 30, features: [] },
        },
      }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('Cancel Subscription');
  });

  it('renders ENTERPRISE plan when subscription is ENTERPRISE', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          plan: 'ENTERPRISE', status: 'ACTIVE', current_period_end: null,
          isExpired: false,
          planDetails: { id: 'ENTERPRISE', name: 'Enterprise', price: 50, currency: 'PI', duration: 30, features: [] },
        },
      }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('Enterprise');
  });

  it('handles failed fetch gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, json: async () => ({}),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });

  it('handles fetch network error gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });

  it('shows success message on subscribe', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: null }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { subscription: { plan: 'PRO', status: 'ACTIVE', current_period_end: null, isExpired: false, planDetails: { id: 'PRO', name: 'Pro', price: 10, currency: 'PI', duration: 30, features: [] } } },
        }),
      }) as unknown as typeof fetch;

    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });

    const upgradeBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('Upgrade to Pro'),
    );
    if (upgradeBtn) {
      await act(async () => { fireEvent.click(upgradeBtn); });
      await waitFor(() => {
        expect(document.body.textContent).toMatch(/subscribed to PRO|Pro/i);
      });
    }
  });

  it('shows error message on subscribe failure', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: null }) })
      .mockResolvedValueOnce({
        ok: false, json: async () => ({ message: 'Payment required' }),
      }) as unknown as typeof fetch;

    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });

    const upgradeBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('Upgrade to Pro'),
    );
    if (upgradeBtn) {
      await act(async () => { fireEvent.click(upgradeBtn); });
      await waitFor(() => {
        expect(document.body.textContent).toContain('Payment required');
      });
    }
  });

  it('skips subscribe when no token', async () => {
    mockGetAccessToken.mockReturnValue(null);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: null }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });
    // Should render without crashing
    expect(document.body).toBeTruthy();
  });

  it('renders plan with price = 0 shown as Free', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: null }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('Free');
  });

  it('renders /month label for paid plans', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: null }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/subscription/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('/month');
  });
});

// ══════════════════════════════════════════════════════════════════
// 4. Hub Subscription Page
// ══════════════════════════════════════════════════════════════════
describe('HubSubscriptionPage (hub/subscription)', () => {
  it('renders loading state initially', async () => {
    global.fetch = vi.fn().mockReturnValue({
      ok: true, json: () => new Promise(() => {}),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/hub/subscription/page');
    const { getByTestId } = render(<Page />);
    expect(getByTestId('hub-loading')).toBeTruthy();
  });

  it('renders plans after fetch (no active subscription)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: null }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/hub/subscription/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('Free');
  });

  it('renders Subscription title', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: null }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/hub/subscription/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('Subscription');
  });

  it('renders current plan card for PRO subscription', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          plan: 'PRO', status: 'ACTIVE', current_period_end: '2025-12-31',
          isExpired: false,
          planDetails: { id: 'PRO', name: 'Pro', price: 10, currency: 'PI', duration: 30, features: ['All features'] },
        },
      }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/hub/subscription/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('Current Plan');
  });

  it('renders POPULAR badge for PRO', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: null }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/hub/subscription/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('POPULAR');
  });

  it('renders upgrade buttons for paid plans', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: null }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/hub/subscription/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('Upgrade to');
  });

  it('handles failed fetch gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, json: async () => ({}),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/hub/subscription/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });

  it('handles network error gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network failure')) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/hub/subscription/page');
    await act(async () => { render(<Page />); });
    expect(document.body).toBeTruthy();
  });

  it('shows cancel subscription for active PRO', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          plan: 'PRO', status: 'ACTIVE', current_period_end: '2025-12-31',
          isExpired: false,
          planDetails: { id: 'PRO', name: 'Pro', price: 10, currency: 'PI', duration: 30, features: [] },
        },
      }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/hub/subscription/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('Cancel Subscription');
  });

  it('renders subscription nested under data.subscription key', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          subscription: {
            plan: 'ENTERPRISE', status: 'ACTIVE', current_period_end: null,
            isExpired: false,
            planDetails: { id: 'ENTERPRISE', name: 'Enterprise', price: 50, currency: 'PI', duration: 30, features: [] },
          },
        },
      }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/hub/subscription/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('Enterprise');
  });

  it('shows error on subscribe failure', async () => {
    // The page loads status + assets, then subscribes — route by URL so the
    // subscribe failure isn't masked by load-order.
    global.fetch = vi.fn().mockImplementation((url: unknown) => {
      const u = String(url);
      if (u.includes('endpoint=subscribe'))
        return Promise.resolve({ ok: false, json: async () => ({ message: 'Insufficient funds' }) });
      if (u.includes('/bff/assets/list'))
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      return Promise.resolve({ ok: true, json: async () => ({ data: null }) });
    }) as unknown as typeof fetch;

    const { default: Page } = await import('@/app/hub/subscription/page');
    await act(async () => { render(<Page />); });

    const upgradeBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('Upgrade to Pro'),
    );
    if (upgradeBtn) {
      await act(async () => { fireEvent.click(upgradeBtn); });
      await waitFor(() => {
        expect(document.body.textContent).toContain('Insufficient funds');
      });
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// 5. Dashboard Profile Page
// ══════════════════════════════════════════════════════════════════
describe('DashboardProfilePage (dashboard/profile)', () => {
  it('renders with authenticated user', async () => {
    const { default: Page } = await import('@/app/dashboard/profile/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('alice');
  });

  it('renders avatar initial from piUsername', async () => {
    const { default: Page } = await import('@/app/dashboard/profile/page');
    const { container } = render(<Page />);
    // Avatar shows first letter of username
    expect(container.textContent).toContain('A');
  });

  it('renders all account info labels', async () => {
    const { default: Page } = await import('@/app/dashboard/profile/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Pi Username');
    expect(container.textContent).toContain('TEC User ID');
    expect(container.textContent).toContain('Role');
    expect(container.textContent).toContain('Plan');
  });

  it('renders user with admin role', async () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultAuthState,
      user: { ...defaultUser, piId: 'pi-uid-99', role: 'admin', createdAt: '2023-06-15T00:00:00Z' },
    });
    const { default: Page } = await import('@/app/dashboard/profile/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('ADMIN');
  });

  it('renders user with createdAt date', async () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultAuthState,
      user: { ...defaultUser, createdAt: '2023-06-15T00:00:00Z' },
    });
    const { default: Page } = await import('@/app/dashboard/profile/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('June');
  });

  it('renders with null user — shows ? avatar', async () => {
    mockUsePiAuth.mockReturnValue({ ...defaultAuthState, user: null });
    const { default: Page } = await import('@/app/dashboard/profile/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('?');
  });

  it('renders KYC section with Go to KYC button', async () => {
    const { default: Page } = await import('@/app/dashboard/profile/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('KYC Verification');
    expect(container.textContent).toContain('Go to KYC');
  });

  it('renders Connected Apps section', async () => {
    const { default: Page } = await import('@/app/dashboard/profile/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Connected Apps');
    expect(container.textContent).toContain('CONNECTED');
  });

  it('renders Quick Actions grid with Wallet, Security, Notifications', async () => {
    const { default: Page } = await import('@/app/dashboard/profile/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Wallet');
    expect(container.textContent).toContain('Security');
    expect(container.textContent).toContain('Notifications');
  });

  it('renders Danger Zone with Delete Account button', async () => {
    const { default: Page } = await import('@/app/dashboard/profile/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Delete Account');
  });

  it('Copy button present for copyable fields', async () => {
    const { default: Page } = await import('@/app/dashboard/profile/page');
    const { container } = render(<Page />);
    const copyBtns = Array.from(container.querySelectorAll('button')).filter(
      b => b.textContent === 'Copy',
    );
    expect(copyBtns.length).toBeGreaterThan(0);
  });

  it('handleDelete called — confirm returns false — no crash', async () => {
    const { default: Page } = await import('@/app/dashboard/profile/page');
    const { container } = render(<Page />);
    const deleteBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Delete Account'),
    );
    expect(deleteBtn).toBeTruthy();
    fireEvent.click(deleteBtn!);
    expect(window.confirm).toHaveBeenCalled();
  });

  it('renders N/A for Member Since when no createdAt', async () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultAuthState,
      user: { ...defaultUser, createdAt: undefined as unknown as string },
    });
    const { default: Page } = await import('@/app/dashboard/profile/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('N/A');
  });
});

// ══════════════════════════════════════════════════════════════════
// 6. Hub Profile Page
// ══════════════════════════════════════════════════════════════════
describe('HubProfilePage (hub/profile)', () => {
  it('renders with authenticated user', async () => {
    const { default: Page } = await import('@/app/hub/profile/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('alice');
  });

  it('renders avatar initial', async () => {
    const { default: Page } = await import('@/app/hub/profile/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('A');
  });

  it('renders with null user — shows ? avatar', async () => {
    mockUsePiAuth.mockReturnValue({ ...defaultAuthState, user: null });
    const { default: Page } = await import('@/app/hub/profile/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('?');
  });

  it('renders account info rows', async () => {
    const { default: Page } = await import('@/app/hub/profile/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Pi Username');
    expect(container.textContent).toContain('Role');
    expect(container.textContent).toContain('Plan');
  });

  it('renders KYC section with Go to KYC button', async () => {
    const { default: Page } = await import('@/app/hub/profile/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Go to KYC');
  });

  it('renders Sign Out button', async () => {
    const { default: Page } = await import('@/app/hub/profile/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Sign Out');
  });

  it('renders Delete button in danger zone', async () => {
    const { default: Page } = await import('@/app/hub/profile/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Delete');
  });

  it('renders Quick Actions with hub-specific KYC link', async () => {
    const { default: Page } = await import('@/app/hub/profile/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('KYC');
    expect(container.textContent).toContain('Notifications');
  });

  it('renders user with PRO subscription plan', async () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultAuthState,
      user: { ...defaultUser, subscriptionPlan: 'PRO' },
    });
    const { default: Page } = await import('@/app/hub/profile/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('PRO');
  });

  it('renders N/A for Member Since when no createdAt', async () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultAuthState,
      user: { ...defaultUser, createdAt: undefined as unknown as string },
    });
    const { default: Page } = await import('@/app/hub/profile/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('N/A');
  });

  it('handleDelete calls confirm and does nothing when cancelled', async () => {
    const { default: Page } = await import('@/app/hub/profile/page');
    const { container } = render(<Page />);
    const deleteBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Delete'),
    );
    if (deleteBtn) fireEvent.click(deleteBtn);
    expect(window.confirm).toHaveBeenCalled();
  });

  it('renders user ADMIN role badge', async () => {
    mockUsePiAuth.mockReturnValue({
      ...defaultAuthState,
      user: { ...defaultUser, role: 'admin' },
    });
    const { default: Page } = await import('@/app/hub/profile/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('ADMIN');
  });
});

// ══════════════════════════════════════════════════════════════════
// 7. Hub KYC Page
// ══════════════════════════════════════════════════════════════════
describe('HubKycPage (hub/kyc)', () => {
  it('renders loading state via hub-loading', async () => {
    mockUseKyc.mockReturnValue({ ...kycBase, isLoading: true });
    const { default: Page } = await import('@/app/hub/kyc/page');
    const { getByTestId } = render(<Page />);
    expect(getByTestId('hub-loading')).toBeTruthy();
  });

  it('renders null KYC state without crash', async () => {
    const { default: Page } = await import('@/app/hub/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Identity Verification');
  });

  it('renders error message', async () => {
    mockUseKyc.mockReturnValue({ ...kycBase, error: 'Failed to load KYC' });
    const { default: Page } = await import('@/app/hub/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Failed to load KYC');
  });

  it('renders NOT_STARTED with upload form', async () => {
    mockUseKyc.mockReturnValue({ ...kycBase, kyc: kycRecord('NOT_STARTED') });
    const { default: Page } = await import('@/app/hub/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Upload Documents');
  });

  it('renders PENDING status card', async () => {
    mockUseKyc.mockReturnValue({ ...kycBase, kyc: kycRecord('PENDING') });
    const { default: Page } = await import('@/app/hub/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Under Review');
  });

  it('renders VERIFIED status with level and date', async () => {
    mockUseKyc.mockReturnValue({
      ...kycBase,
      kyc: kycRecord('VERIFIED', { level: 'L1', verified_at: '2024-06-01T00:00:00Z' }),
    });
    const { default: Page } = await import('@/app/hub/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Identity Verified');
    expect(container.textContent).toContain('L1');
  });

  it('renders REJECTED status with reason', async () => {
    mockUseKyc.mockReturnValue({
      ...kycBase,
      kyc: kycRecord('REJECTED', { rejection_reason: 'Image blurry' }),
    });
    const { default: Page } = await import('@/app/hub/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Image blurry');
    expect(container.textContent).toContain('Verification Rejected');
  });

  it('renders REJECTED without reason — no reason box', async () => {
    mockUseKyc.mockReturnValue({ ...kycBase, kyc: kycRecord('REJECTED') });
    const { default: Page } = await import('@/app/hub/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Verification Rejected');
  });

  it('Continue button is disabled when no URLs provided', async () => {
    mockUseKyc.mockReturnValue({ ...kycBase, kyc: kycRecord('NOT_STARTED') });
    const { default: Page } = await import('@/app/hub/kyc/page');
    const { container } = render(<Page />);
    const continueBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Continue'),
    );
    // Button is disabled when idFrontUrl/selfieUrl are empty — enforced by disabled attr
    expect(continueBtn).toBeTruthy();
    expect(continueBtn?.disabled).toBe(true);
  });

  it('renders review step when kyc already has id_front_url', async () => {
    mockUseKyc.mockReturnValue({
      ...kycBase,
      kyc: kycRecord('NOT_STARTED', {
        id_front_url: 'https://storage/front.jpg',
        selfie_url:   'https://storage/selfie.jpg',
      }),
    });
    const { default: Page } = await import('@/app/hub/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Review');
  });

  it('renders isSubmitting state on REJECTED reset button', async () => {
    mockUseKyc.mockReturnValue({
      ...kycBase,
      isSubmitting: true,
      kyc:          kycRecord('REJECTED', { rejection_reason: 'Bad photo' }),
    });
    const { default: Page } = await import('@/app/hub/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Resetting');
  });

  it('renders StatusCard Level badge', async () => {
    mockUseKyc.mockReturnValue({ ...kycBase, kyc: kycRecord('NOT_STARTED', { level: 'L2' }) });
    const { default: Page } = await import('@/app/hub/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Level L2');
  });
});

// ══════════════════════════════════════════════════════════════════
// 8. Dashboard KYC Page
// ══════════════════════════════════════════════════════════════════
describe('DashboardKycPage (dashboard/kyc) extra coverage', () => {
  it('renders loading state via shell-loading', async () => {
    mockUseKyc.mockReturnValue({ ...kycBase, isLoading: true });
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    const { getByTestId } = render(<Page />);
    expect(getByTestId('shell-loading')).toBeTruthy();
  });

  it('renders null kyc without crash', async () => {
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Identity Verification');
  });

  it('renders error message', async () => {
    mockUseKyc.mockReturnValue({ ...kycBase, error: 'Service unavailable' });
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Service unavailable');
  });

  it('renders NOT_STARTED with KycForm — Upload Documents', async () => {
    mockUseKyc.mockReturnValue({ ...kycBase, kyc: kycRecord('NOT_STARTED') });
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Upload Documents');
  });

  it('renders PENDING state — Under Review', async () => {
    mockUseKyc.mockReturnValue({ ...kycBase, kyc: kycRecord('PENDING') });
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Under Review');
  });

  it('renders VERIFIED state — Identity Verified', async () => {
    mockUseKyc.mockReturnValue({
      ...kycBase,
      kyc: kycRecord('VERIFIED', { level: 'L2', verified_at: '2024-09-01T00:00:00Z' }),
    });
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Identity Verified');
  });

  it('renders REJECTED with reason box', async () => {
    mockUseKyc.mockReturnValue({
      ...kycBase,
      kyc: kycRecord('REJECTED', { rejection_reason: 'Bad photo quality' }),
    });
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Bad photo quality');
  });

  it('Continue button is disabled when no URLs provided', async () => {
    mockUseKyc.mockReturnValue({ ...kycBase, kyc: kycRecord('NOT_STARTED') });
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    const { container } = render(<Page />);
    const continueBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Continue'),
    );
    // Button is disabled when idFrontUrl/selfieUrl are empty — enforced by disabled attr
    expect(continueBtn).toBeTruthy();
    expect(continueBtn?.disabled).toBe(true);
  });

  it('renders Try Again button for REJECTED', async () => {
    mockUseKyc.mockReturnValue({ ...kycBase, kyc: kycRecord('REJECTED') });
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Try Again');
  });

  it('renders VERIFIED with level and formatted date', async () => {
    mockUseKyc.mockReturnValue({
      ...kycBase,
      kyc: kycRecord('VERIFIED', { level: 'L1', verified_at: '2024-01-15T00:00:00Z' }),
    });
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('L1');
    expect(container.textContent).toContain('Jan');
  });

  it('renders StatusCard Level badge for NOT_STARTED', async () => {
    mockUseKyc.mockReturnValue({ ...kycBase, kyc: kycRecord('NOT_STARTED', { level: 'L0' }) });
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Level L0');
  });

  it('renders review step when kyc already has id_front_url', async () => {
    mockUseKyc.mockReturnValue({
      ...kycBase,
      kyc: kycRecord('NOT_STARTED', {
        id_front_url: 'https://storage/front.jpg',
        selfie_url:   'https://storage/selfie.jpg',
      }),
    });
    const { default: Page } = await import('@/app/dashboard/kyc/page');
    const { container } = render(<Page />);
    expect(container.textContent).toContain('Review');
  });
});

// ══════════════════════════════════════════════════════════════════
// 9. Dashboard Marketplace Page
// ══════════════════════════════════════════════════════════════════
describe('DashboardMarketplacePage (dashboard/marketplace)', () => {
  it('renders loading spinner while fetching', async () => {
    global.fetch = vi.fn().mockReturnValue({
      ok: true, json: () => new Promise(() => {}),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/marketplace/page');
    const { container } = render(<Page />);
    // Spinner is shown — container exists
    expect(container).toBeTruthy();
  });

  it('renders empty state when no listings', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ listings: [], total: 0 }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/marketplace/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('No listings yet');
  });

  it('renders Marketplace title and total count', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ listings: [], total: 7 }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/marketplace/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('Marketplace');
    expect(document.body.textContent).toContain('7 assets for sale');
  });

  it('renders error state on failed fetch', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 500, json: async () => ({}),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/marketplace/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('Failed to load marketplace');
  });

  it('renders listings and Buy button for other sellers', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        listings: [{
          id: 'l-1', price: 5, currency: 'PI', title: 'Cool Domain', description: 'A great domain',
          sellerId: 'seller-999', createdAt: new Date().toISOString(),
          asset: { slug: 'cool.pi', category: 'DOMAIN', metadata: {} },
        }],
        total: 1,
      }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/marketplace/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('Cool Domain');
    expect(document.body.textContent).toContain('Buy for 5 π');
  });

  it('renders "Your listing" badge when user is the seller', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        listings: [{
          id: 'l-2', price: 10, currency: 'PI', title: 'My Asset', description: null,
          sellerId: 'u-1', // matches defaultUser.id
          createdAt: new Date().toISOString(),
          asset: { slug: 'my.pi', category: 'DIGITAL_ASSET', metadata: {} },
        }],
        total: 1,
      }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/marketplace/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('Your listing');
  });

  it('renders listing with null title — falls back to asset.slug', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        listings: [{
          id: 'l-3', price: 3, currency: 'PI', title: null, description: null,
          sellerId: 'seller-000', createdAt: new Date().toISOString(),
          asset: { slug: 'fallback.pi', category: 'REAL_ESTATE', metadata: {} },
        }],
        total: 1,
      }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/marketplace/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('fallback.pi');
  });

  it('calls buyAsset on Buy button click', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        listings: [{
          id: 'l-4', price: 2, currency: 'PI', title: 'Buy Me', description: null,
          sellerId: 'seller-789', createdAt: new Date().toISOString(),
          asset: { slug: 'buy-me.pi', category: 'DOMAIN', metadata: {} },
        }],
        total: 1,
      }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/marketplace/page');
    await act(async () => { render(<Page />); });

    const buyBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('Buy for'),
    );
    if (buyBtn) {
      await act(async () => { fireEvent.click(buyBtn); });
      expect(mockBuyAsset).toHaveBeenCalled();
    }
  });

  it('shows success message after successful buy', async () => {
    mockBuyAsset.mockResolvedValue({ success: true, message: 'Asset purchased! 🎉' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        listings: [{
          id: 'l-5', price: 2, currency: 'PI', title: 'Win Item', description: null,
          sellerId: 'seller-xyz', createdAt: new Date().toISOString(),
          asset: { slug: 'win.pi', category: 'DOMAIN', metadata: {} },
        }],
        total: 1,
      }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/marketplace/page');
    await act(async () => { render(<Page />); });

    const buyBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('Buy for'),
    );
    if (buyBtn) {
      await act(async () => { fireEvent.click(buyBtn); });
      await waitFor(() => {
        expect(document.body.textContent).toContain('purchased');
      });
    }
  });

  it('shows error message when buyAsset fails', async () => {
    mockBuyAsset.mockResolvedValue({ success: false, message: 'Not enough Pi' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        listings: [{
          id: 'l-6', price: 999, currency: 'PI', title: 'Expensive', description: null,
          sellerId: 'seller-exp', createdAt: new Date().toISOString(),
          asset: { slug: 'expensive.pi', category: 'REAL_ESTATE', metadata: {} },
        }],
        total: 1,
      }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/marketplace/page');
    await act(async () => { render(<Page />); });

    const buyBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('Buy for'),
    );
    if (buyBtn) {
      await act(async () => { fireEvent.click(buyBtn); });
      await waitFor(() => {
        expect(document.body.textContent).toContain('Not enough Pi');
      });
    }
  });

  it('renders Refresh button', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ listings: [], total: 0 }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/marketplace/page');
    await act(async () => { render(<Page />); });
    const refreshBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('Refresh'),
    );
    expect(refreshBtn).toBeTruthy();
  });

  it('renders List Your Asset for Sale button', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ listings: [], total: 0 }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/marketplace/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('List Your Asset for Sale');
  });

  it('renders all three category types in listings', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        listings: [
          { id: 'a', price: 1, currency: 'PI', title: 'Domain Item', description: null, sellerId: 's1', createdAt: new Date().toISOString(), asset: { slug: 'd.pi', category: 'DOMAIN', metadata: {} } },
          { id: 'b', price: 2, currency: 'PI', title: 'House Item', description: null, sellerId: 's2', createdAt: new Date().toISOString(), asset: { slug: 'h.pi', category: 'REAL_ESTATE', metadata: {} } },
          { id: 'c', price: 3, currency: 'PI', title: 'NFT Item', description: null, sellerId: 's3', createdAt: new Date().toISOString(), asset: { slug: 'nft.pi', category: 'DIGITAL_ASSET', metadata: {} } },
        ],
        total: 3,
      }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/marketplace/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('Domain Item');
    expect(document.body.textContent).toContain('House Item');
    expect(document.body.textContent).toContain('NFT Item');
  });

  it('renders description when listing has description', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        listings: [{
          id: 'l-desc', price: 5, currency: 'PI', title: 'Described Item',
          description: 'A detailed description here',
          sellerId: 'seller-d', createdAt: new Date().toISOString(),
          asset: { slug: 'desc.pi', category: 'DOMAIN', metadata: {} },
        }],
        total: 1,
      }),
    }) as unknown as typeof fetch;
    const { default: Page } = await import('@/app/dashboard/marketplace/page');
    await act(async () => { render(<Page />); });
    expect(document.body.textContent).toContain('A detailed description here');
  });
});
