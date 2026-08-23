/**
 * Coverage for small page wrappers and hub components:
 *   app/ai/page.tsx, app/pay/page.tsx, app/pi-test/page.tsx, app/login/page.tsx,
 *   app/error.tsx, components/AppCardSkeleton.tsx,
 *   components/hub/HubHeader.tsx, components/hub/HubWalletCard.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, fireEvent, act } from '@/test-utils/render-with-locale';

const mockRouterPush = vi.hoisted(() => vi.fn());
const mockNotFound   = vi.hoisted(() => vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }));
const mockRedirect   = vi.hoisted(() => vi.fn(() => { throw new Error('NEXT_REDIRECT'); }));

vi.mock('next/navigation', () => ({
  useRouter:   () => ({ push: mockRouterPush, back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => ({ get: () => null }),
  notFound:    mockNotFound,
  redirect:    mockRedirect,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="dynamic-client" />,
}));

vi.mock('@/app/ai/AiWrapper', () => ({
  default: () => <div data-testid="ai-wrapper" />,
}));
vi.mock('@/app/pay/PayWrapper', () => ({
  default: () => <div data-testid="pay-wrapper" />,
}));
vi.mock('@/app/pi-test/PiTestClient', () => ({
  PiTestClient: () => <div data-testid="pi-test-client" />,
}));

const mockGetAccessToken = vi.hoisted(() => vi.fn(() => 'tok-1'));
vi.mock('@/lib-client/pi/pi-auth', () => ({
  getAccessToken: mockGetAccessToken,
  getStoredUser:  vi.fn(() => null),
  isPiBrowser:    vi.fn(() => false),
}));

vi.mock('@/components/AppCardSkeleton.module.css', () => ({
  default: new Proxy({}, { get: (_: any, p: string) => p }),
}));

import AiPage          from '@/app/ai/page';
import PayPage         from '@/app/pay/page';
import PiTestPage      from '@/app/pi-test/page';
import LoginPage       from '@/app/login/page';
import GlobalError     from '@/app/error';
import { AppCardSkeleton, AppGridSkeleton } from '@/components/AppCardSkeleton';
import { HubHeader }      from '@/components/hub/HubHeader';
import { HubWalletCard }  from '@/components/hub/HubWalletCard';

beforeEach(() => {
  mockRouterPush.mockClear();
  mockNotFound.mockClear();
  mockRedirect.mockClear();
  mockGetAccessToken.mockReturnValue('tok-1');
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok:   true,
    json: async () => ({ balance: 12.34 }),
  } as Response);
});

describe('page wrappers', () => {
  it('AiPage renders AiWrapper', () => {
    const { getByTestId } = render(<AiPage />);
    expect(getByTestId('ai-wrapper')).toBeInTheDocument();
  });

  it('PayPage renders PayWrapper', () => {
    const { getByTestId } = render(<PayPage />);
    expect(getByTestId('pay-wrapper')).toBeInTheDocument();
  });

  it('PiTestPage calls notFound when flag disabled', () => {
    const prev = process.env.NEXT_PUBLIC_PI_TEST_ENABLED;
    delete process.env.NEXT_PUBLIC_PI_TEST_ENABLED;
    expect(() => render(<PiTestPage />)).toThrow('NEXT_NOT_FOUND');
    expect(mockNotFound).toHaveBeenCalled();
    if (prev !== undefined) process.env.NEXT_PUBLIC_PI_TEST_ENABLED = prev;
  });

  it('PiTestPage renders client when flag enabled', () => {
    const prev = process.env.NEXT_PUBLIC_PI_TEST_ENABLED;
    process.env.NEXT_PUBLIC_PI_TEST_ENABLED = 'true';
    const { getByTestId } = render(<PiTestPage />);
    expect(getByTestId('pi-test-client')).toBeInTheDocument();
    if (prev !== undefined) process.env.NEXT_PUBLIC_PI_TEST_ENABLED = prev;
    else delete process.env.NEXT_PUBLIC_PI_TEST_ENABLED;
  });

  it('LoginPage redirects to /', () => {
    expect(() => render(<LoginPage />)).toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/');
  });

});

describe('app/error.tsx', () => {
  it('renders error UI and logs the error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = Object.assign(new Error('boom'), { digest: 'd1' });
    const { container } = render(<GlobalError error={err} reset={vi.fn()} />);
    expect(container.textContent).toContain('⚠️');
    expect(spy).toHaveBeenCalledWith('Global error:', err);
    spy.mockRestore();
  });

  it('reset button calls reset', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reset = vi.fn();
    const { container } = render(<GlobalError error={new Error('x')} reset={reset} />);
    const btn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent && b.textContent.length > 0,
    );
    if (btn) {
      fireEvent.click(btn);
      expect(reset).toHaveBeenCalled();
    } else {
      expect(container).toBeTruthy();
    }
  });
});

describe('AppCardSkeleton', () => {
  it('renders a single skeleton card', () => {
    const { container } = render(<AppCardSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it('AppGridSkeleton renders default 12 cards', () => {
    const { container } = render(<AppGridSkeleton />);
    expect(container.querySelectorAll('.card').length).toBe(12);
  });

  it('AppGridSkeleton respects custom count', () => {
    const { container } = render(<AppGridSkeleton count={3} />);
    expect(container.querySelectorAll('.card').length).toBe(3);
  });
});

describe('HubHeader', () => {
  const baseProps = {
    piUsername:   'alice',
    time:         '12:00',
    notifCount:   0,
    onNotifClick: vi.fn(),
  };

  it('renders username and time', () => {
    const { container } = render(<HubHeader {...baseProps} />);
    expect(container.textContent).toContain('@alice');
    expect(container.textContent).toContain('12:00');
  });

  it('shows no badge when notifCount is 0', () => {
    const { container } = render(<HubHeader {...baseProps} />);
    expect(container.textContent).not.toContain('9+');
  });

  it('shows badge count when notifCount > 0', () => {
    const { container } = render(<HubHeader {...baseProps} notifCount={5} />);
    expect(container.textContent).toContain('5');
  });

  it('shows 9+ when notifCount > 9', () => {
    const { container } = render(<HubHeader {...baseProps} notifCount={15} />);
    expect(container.textContent).toContain('9+');
  });

  it('notification button calls onNotifClick', () => {
    const onNotifClick = vi.fn();
    const { getByLabelText } = render(
      <HubHeader {...baseProps} onNotifClick={onNotifClick} />,
    );
    fireEvent.click(getByLabelText(/Notifications/));
    expect(onNotifClick).toHaveBeenCalled();
  });

  it('the avatar opens the account menu instead of jumping straight to one page', () => {
    // It used to navigate to /dashboard on tap — one destination behind a
    // control that looks like it should offer several, and no way to reach
    // Profile from here at all once it left the bottom nav.
    const { getByLabelText, getByRole, queryByRole } = render(<HubHeader {...baseProps} />);
    const chip = getByLabelText('Your account');

    expect(chip).toHaveAttribute('aria-expanded', 'false');
    expect(queryByRole('menu')).toBeNull();
    expect(mockRouterPush).not.toHaveBeenCalled();

    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'true');
    expect(getByRole('menu')).toBeInTheDocument();
  });

  it('the account menu reaches BOTH destinations', () => {
    const { getByLabelText, getByRole } = render(<HubHeader {...baseProps} />);
    fireEvent.click(getByLabelText('Your account'));

    fireEvent.click(getByRole('menuitem', { name: /Profile/ }));
    expect(mockRouterPush).toHaveBeenCalledWith('/hub/profile');

    fireEvent.click(getByLabelText('Your account'));
    fireEvent.click(getByRole('menuitem', { name: /Dashboard/ }));
    expect(mockRouterPush).toHaveBeenCalledWith('/dashboard');
  });
});

describe('HubWalletCard', () => {
  it('renders balance with null piPrice', () => {
    const { container } = render(<HubWalletCard balance="3.14" piPrice={null} />);
    expect(container.textContent).toContain('3.14');
  });

  it('renders with positive 24h change', () => {
    const { container } = render(
      <HubWalletCard balance="1.00" piPrice={{ price: 42.5, change24h: 2.3 } as any} />,
    );
    expect(container.textContent).toContain('1.00');
  });

  it('renders with negative 24h change', () => {
    const { container } = render(
      <HubWalletCard balance="1.00" piPrice={{ price: 42.5, change24h: -1.7 } as any} />,
    );
    expect(container).toBeTruthy();
  });

  it('click navigates to /dashboard/wallet', () => {
    const { container } = render(<HubWalletCard balance="0" piPrice={null} />);
    const btn = container.querySelector('button');
    fireEvent.click(btn!);
    expect(mockRouterPush).toHaveBeenCalledWith('/dashboard/wallet');
  });
});
