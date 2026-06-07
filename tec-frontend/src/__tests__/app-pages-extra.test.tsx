/**
 * Smoke tests for error.tsx, not-found.tsx, and PaymentModal.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/lib-client/pi/pi-session', () => ({
  piSession: {
    ensurePaymentsReady: vi.fn().mockResolvedValue(true),
    acquirePaymentLock:  vi.fn().mockResolvedValue(true),
    releasePaymentLock:  vi.fn(),
    reset:               vi.fn(),
    reInit:              vi.fn(),
    lastError:           null,
    lastRawError:        null,
  },
  PiAuthError: {},
}));

vi.mock('@/lib-client/pi/pi-payment', () => ({
  createU2APayment:    vi.fn().mockResolvedValue({ success: true, status: 'completed', txid: 'tx1', paymentId: 'p1' }),
  createPaymentRecord: vi.fn().mockResolvedValue('payment-id-1'),
}));

vi.mock('@/lib-client/pi/PiRuntime', () => ({
  PiRuntime: {
    init:          vi.fn(),
    authenticate:  vi.fn(),
    createPayment: vi.fn(),
    canAttempt:    vi.fn(() => true),
    isReady:       vi.fn(() => true),
    isAvailable:   vi.fn(() => true),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Error boundary page ────────────────────────────────────────
describe('Error page (error.tsx)', () => {
  it('renders error message and reset button', async () => {
    const { default: ErrorPage } = await import('@/app/error');
    const mockError = new Error('Test error message');
    const mockReset = vi.fn();
    const { container } = render(<ErrorPage error={mockError} reset={mockReset} />);
    expect(container).toBeTruthy();
    expect(container.querySelector('button')).toBeTruthy();
  });

  it('renders with digest ID when provided', async () => {
    const { default: ErrorPage } = await import('@/app/error');
    const mockError = Object.assign(new Error('Oops'), { digest: 'err-digest-123' });
    const { container } = render(<ErrorPage error={mockError} reset={vi.fn()} />);
    expect(container).toBeTruthy();
    expect(container.textContent).toContain('err-digest-123');
  });

  it('renders without digest when not provided', async () => {
    const { default: ErrorPage } = await import('@/app/error');
    const mockError = new Error('No digest');
    const { container } = render(<ErrorPage error={mockError} reset={vi.fn()} />);
    expect(container).toBeTruthy();
  });
});

// ── Not Found page ─────────────────────────────────────────────
describe('NotFound page (not-found.tsx)', () => {
  it('renders 404 page without crash', async () => {
    const { default: NotFoundPage } = await import('@/app/not-found');
    const { container } = render(<NotFoundPage />);
    expect(container).toBeTruthy();
    expect(container.textContent).toContain('404');
  });
});

// ── PaymentModal component ─────────────────────────────────────
describe('PaymentModal', () => {
  const payment = {
    amount:     5,
    memo:       'Test payment',
    productId:  'p1',
    returnUrl:  'https://commerce.tecosystem.app',
    source:     'commerce',
    internalId: 'internal-1',
  };

  it('renders idle state with commerce source label', async () => {
    const { PaymentModal } = await import('@/app/hub/components/PaymentModal');
    const { container } = render(
      <PaymentModal
        payment={payment}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
    expect(container.textContent).toContain('TEC Commerce');
    expect(container.textContent).toContain('5π');
  });

  it('renders with ecommerce source', async () => {
    const { PaymentModal } = await import('@/app/hub/components/PaymentModal');
    const { container } = render(
      <PaymentModal
        payment={{ ...payment, source: 'ecommerce', amount: 10 }}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
    expect(container.textContent).toContain('TEC Ecommerce');
    expect(container.textContent).toContain('10π');
  });

  it('renders with assets source', async () => {
    const { PaymentModal } = await import('@/app/hub/components/PaymentModal');
    const { container } = render(
      <PaymentModal
        payment={{ ...payment, source: 'assets' }}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
    expect(container.textContent).toContain('TEC Assets');
  });

  it('renders cancel button in idle state', async () => {
    const { PaymentModal } = await import('@/app/hub/components/PaymentModal');
    const { container } = render(
      <PaymentModal
        payment={payment}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders memo text', async () => {
    const { PaymentModal } = await import('@/app/hub/components/PaymentModal');
    const { container } = render(
      <PaymentModal
        payment={{ ...payment, memo: 'Buy Widget' }}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    expect(container.textContent).toContain('Buy Widget');
  });
});
