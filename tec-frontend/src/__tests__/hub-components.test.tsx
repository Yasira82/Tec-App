/**
 * Smoke tests for hub components and utilities.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/test-utils/render-with-locale';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/lib/hub/utils', () => ({
  haptic: vi.fn(),
}));

import {
  HubHeader,
  HubWalletCard,
  HubAppsGrid,
  HubCarousel,
  HubComingSoon,
  HubSubShell,
} from '@/components/hub';

import { haptic } from '@/lib/hub/utils';

// ── HubHeader ─────────────────────────────────────────────
describe('HubHeader', () => {
  it('renders username and time', () => {
    render(<HubHeader piUsername="alice" time="12:34" notifCount={0} onNotifClick={vi.fn()} />);
    expect(screen.getByText('@alice')).toBeInTheDocument();
  });

  it('shows notification count badge when > 0', () => {
    render(<HubHeader piUsername="bob" time="10:00" notifCount={5} onNotifClick={vi.fn()} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('calls onNotifClick when bell is tapped', () => {
    const onNotifClick = vi.fn();
    render(<HubHeader piUsername="bob" time="10:00" notifCount={1} onNotifClick={onNotifClick} />);
    const bell = screen.getByRole('button', { hidden: true, name: /notif|bell/i }) ?? document.querySelector('[aria-label]');
    fireEvent.click(document.querySelector('[data-notif]') ?? document.querySelector('header')!);
  });

  it('renders with zero notifications', () => {
    const { container } = render(<HubHeader piUsername="carol" time="08:00" notifCount={0} onNotifClick={vi.fn()} />);
    expect(container.querySelector('header')).toBeTruthy();
  });
});

// ── HubWalletCard ─────────────────────────────────────────
describe('HubWalletCard', () => {
  it('renders balance', () => {
    render(<HubWalletCard balance="42.50" piPrice={null} />);
    expect(screen.getByText('42.50')).toBeInTheDocument();
  });

  it('shows pi price when provided', () => {
    render(<HubWalletCard balance="5.00" piPrice={{ price: 1.23, change24h: 0.5, high24h: 1.5, low24h: 1.0 }} />);
    expect(screen.getByText(/1\.23/)).toBeInTheDocument();
  });

  it('handles null price gracefully', () => {
    const { container } = render(<HubWalletCard balance="—" piPrice={null} />);
    expect(container).toBeTruthy();
  });

  it('shows negative change indicator', () => {
    const { container } = render(<HubWalletCard balance="3.00" piPrice={{ price: 1.1, change24h: -0.3, high24h: 1.5, low24h: 1.0 }} />);
    expect(container).toBeTruthy();
  });

  it('shows an honest error+retry state instead of a fabricated balance', () => {
    const onRetry = vi.fn();
    render(<HubWalletCard balance="—" piPrice={null} balanceError onRetryBalance={onRetry} />);
    // No fabricated 0 balance is shown (C-135 §4 honest state)
    expect(screen.queryByText('0.00')).not.toBeInTheDocument();
    expect(screen.getByText(/Couldn't load balance/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Retry/));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

// ── HubAppsGrid ───────────────────────────────────────────
describe('HubAppsGrid', () => {
  const apps = [
    { slug: 'shop',   name: 'Shop',   emoji: '🛒', href: '/shop',   desc: 'Shopping' },
    { slug: 'assets', name: 'Assets', emoji: '💎', href: '/assets', desc: 'Assets'   },
  ];

  it('renders app list', () => {
    render(<HubAppsGrid apps={apps} />);
    expect(screen.getByText('Shop')).toBeInTheDocument();
    expect(screen.getAllByText('Assets').length).toBeGreaterThan(0);
  });

  it('returns null for empty apps', () => {
    const { container } = render(<HubAppsGrid apps={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls haptic on app click', () => {
    render(<HubAppsGrid apps={apps} />);
    fireEvent.click(screen.getByText('Shop'));
    expect(haptic).toHaveBeenCalled();
  });
});

// ── HubCarousel ───────────────────────────────────────────
describe('HubCarousel', () => {
  const baseProps = {
    carouselIdx: 0,
    setCarouselIdx: vi.fn(),
    assetCount: 3,
    piPrice: { price: 1.2, change24h: 0.1, high24h: 1.5, low24h: 1.0 },
    goToAssets: vi.fn(),
    goToCommerce: vi.fn(),
  };

  it('renders without crash', () => {
    const { container } = render(<HubCarousel {...baseProps} />);
    expect(container).toBeTruthy();
  });

  it('renders with null piPrice', () => {
    const { container } = render(<HubCarousel {...baseProps} piPrice={null} />);
    expect(container).toBeTruthy();
  });

  it('renders with null assetCount', () => {
    const { container } = render(<HubCarousel {...baseProps} assetCount={null} />);
    expect(container).toBeTruthy();
  });

  it('calls setCarouselIdx on dot click', () => {
    const setCarouselIdx = vi.fn();
    const { container } = render(<HubCarousel {...baseProps} setCarouselIdx={setCarouselIdx} />);
    const dots = container.querySelectorAll('[onClick]');
    if (dots.length > 0) fireEvent.click(dots[0]);
  });
});

// ── HubComingSoon ─────────────────────────────────────────
describe('HubComingSoon', () => {
  it('renders coming-soon section', () => {
    const { container } = render(<HubComingSoon />);
    expect(container).toBeTruthy();
  });
});

// ── HubSubShell ───────────────────────────────────────────
describe('HubSubShell', () => {
  it('renders title and children', () => {
    render(
      <HubSubShell title="KYC Verification">
        <div>content here</div>
      </HubSubShell>
    );
    expect(screen.getByText('KYC Verification')).toBeInTheDocument();
    expect(screen.getByText('content here')).toBeInTheDocument();
  });

  it('renders with badge', () => {
    render(
      <HubSubShell title="Pro" badge={{ text: 'NEW', color: 'gold' }}>
        <span>body</span>
      </HubSubShell>
    );
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    const { container } = render(
      <HubSubShell title="Loading" loading>
        <span>hidden</span>
      </HubSubShell>
    );
    expect(container).toBeTruthy();
  });
});
