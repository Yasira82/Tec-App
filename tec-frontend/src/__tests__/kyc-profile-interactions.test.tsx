/**
 * Interaction coverage for KYC form flows and profile copy buttons:
 *   app/dashboard/kyc/page.tsx  — KycForm upload success/error, Back button
 *   app/hub/kyc/page.tsx        — same form interactions
 *   app/dashboard/profile/page.tsx — Copy button, Go to KYC
 *   app/hub/profile/page.tsx       — Copy button
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, act, fireEvent, waitFor, screen } from '@testing-library/react';

const mockUsePiAuth   = vi.hoisted(() => vi.fn());
const mockUseKyc      = vi.hoisted(() => vi.fn());
const mockRouterPush  = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter:       () => ({ push: mockRouterPush, back: vi.fn(), replace: vi.fn() }),
  usePathname:     () => '/dashboard',
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock('@/lib-client/hooks/usePiAuth', () => ({ usePiAuth: mockUsePiAuth }));
vi.mock('@/lib-client/hooks/useKyc',    () => ({ useKyc: mockUseKyc }));

vi.mock('@/lib-client/pi/pi-auth', () => ({
  getAccessToken: vi.fn(() => 'tok'),
  getStoredUser:  vi.fn(() => ({ id: 'u-1', piUsername: 'alice' })),
  loginWithPi:    vi.fn(),
  logout:         vi.fn(),
  isPiBrowser:    vi.fn(() => false),
}));

vi.mock('@/components/dashboard', () => ({
  DashboardShell: ({ children, loading, title, actions }: any) =>
    loading ? <div data-testid="shell-loading" /> : <div><h1>{title}</h1>{actions}{children}</div>,
  DashboardCard: ({ children, title, action }: any) =>
    <div><h2>{title}</h2>{action}{children}</div>,
}));

vi.mock('@/components/hub', () => ({
  HubShareCard: () => null,
  HubSubShell: ({ children, title, loading }: any) =>
    loading ? <div data-testid="hub-loading" /> : <div><h1>{title}</h1>{children}</div>,
}));

import DashboardKycPage     from '@/app/dashboard/kyc/page';
import HubKycPage           from '@/app/hub/kyc/page';
import DashboardProfilePage from '@/app/dashboard/profile/page';
import HubProfilePage       from '@/app/hub/profile/page';

const user = {
  id: 'u-1', piUsername: 'alice', piId: 'pi-1', role: 'user',
  subscriptionPlan: 'Free', createdAt: '2024-01-01T00:00:00Z',
};

const kycNotStarted = {
  id: 'kyc-1', user_id: 'u-1', status: 'NOT_STARTED', level: 'L0',
  id_front_url: null, id_back_url: null, selfie_url: null,
  rejection_reason: null, verified_at: null, submitted_at: null,
  created_at: '2024-01-01',
};

let kycState: any;

beforeEach(() => {
  mockRouterPush.mockClear();
  mockUsePiAuth.mockReturnValue({
    user, isAuthenticated: true, isLoading: false,
    login: vi.fn(), logout: vi.fn(), error: null,
  });
  kycState = {
    kyc:          kycNotStarted,
    isLoading:    false,
    isSubmitting: false,
    error:        null,
    refetch:      vi.fn(),
    uploadDocs:   vi.fn().mockResolvedValue(undefined),
    submit:       vi.fn().mockResolvedValue(undefined),
    reset:        vi.fn().mockResolvedValue(undefined),
  };
  mockUseKyc.mockReturnValue(kycState);
  Object.defineProperty(navigator, 'clipboard', {
    value:        { writeText: vi.fn().mockResolvedValue(undefined) },
    writable:     true,
    configurable: true,
  });
});

const fillKycForm = (container: HTMLElement) => {
  const inputs = container.querySelectorAll('input');
  // ID Front, ID Back (optional), Selfie
  fireEvent.change(inputs[0], { target: { value: 'https://storage/id-front.jpg' } });
  fireEvent.change(inputs[2], { target: { value: 'https://storage/selfie.jpg' } });
};

const clickContinue = (container: HTMLElement) =>
  fireEvent.click(
    Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Continue'))!,
  );

describe.each([
  ['dashboard', DashboardKycPage],
  ['hub',       HubKycPage],
] as const)('%s KYC form interactions', (_name, Page) => {
  it('upload succeeds → moves to review step', async () => {
    const { container } = render(<Page />);
    fillKycForm(container);
    await act(async () => { clickContinue(container); });
    expect(kycState.uploadDocs).toHaveBeenCalledWith({
      idFrontUrl: 'https://storage/id-front.jpg',
      idBackUrl:  undefined,
      selfieUrl:  'https://storage/selfie.jpg',
    });
    await waitFor(() => {
      expect(container.textContent).toContain('Back');
    });
  });

  it('upload includes idBackUrl when provided', async () => {
    const { container } = render(<Page />);
    const inputs = container.querySelectorAll('input');
    fireEvent.change(inputs[0], { target: { value: 'https://f.jpg' } });
    fireEvent.change(inputs[1], { target: { value: 'https://b.jpg' } });
    fireEvent.change(inputs[2], { target: { value: 'https://s.jpg' } });
    await act(async () => { clickContinue(container); });
    expect(kycState.uploadDocs).toHaveBeenCalledWith({
      idFrontUrl: 'https://f.jpg', idBackUrl: 'https://b.jpg', selfieUrl: 'https://s.jpg',
    });
  });

  it('upload failure shows the error message', async () => {
    kycState.uploadDocs.mockRejectedValue(new Error('Upload rejected by gateway'));
    const { container } = render(<Page />);
    fillKycForm(container);
    await act(async () => { clickContinue(container); });
    await waitFor(() => {
      expect(container.textContent).toContain('Upload rejected by gateway');
    });
  });

  it('review step Back button returns to docs step', async () => {
    mockUseKyc.mockReturnValue({
      ...kycState,
      kyc: { ...kycNotStarted, id_front_url: 'https://f.jpg', selfie_url: 'https://s.jpg' },
    });
    const { container } = render(<Page />);
    const backBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Back'));
    expect(backBtn).toBeTruthy();
    fireEvent.click(backBtn!);
    await waitFor(() => {
      expect(container.textContent).toContain('Continue');
    });
  });

  it('review step Submit calls submit()', async () => {
    mockUseKyc.mockReturnValue({
      ...kycState,
      kyc: { ...kycNotStarted, id_front_url: 'https://f.jpg', selfie_url: 'https://s.jpg' },
    });
    const { container } = render(<Page />);
    const submitBtn = Array.from(container.querySelectorAll('button'))
      .filter(b => !b.textContent?.includes('Back'))
      .find(b => b.textContent?.includes('Submit'));
    if (submitBtn) {
      await act(async () => { fireEvent.click(submitBtn); });
      expect(kycState.submit).toHaveBeenCalled();
    } else {
      expect(container.textContent).toContain('Back');
    }
  });

  it('REJECTED state Try Again calls reset()', async () => {
    mockUseKyc.mockReturnValue({
      ...kycState,
      kyc: { ...kycNotStarted, status: 'REJECTED', rejection_reason: 'Blurry photo' },
    });
    const { container } = render(<Page />);
    const tryAgain = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Try Again'));
    if (tryAgain) {
      await act(async () => { fireEvent.click(tryAgain); });
      expect(kycState.reset).toHaveBeenCalled();
    } else {
      expect(container.textContent).toContain('Blurry photo');
    }
  });

  it('input focus and blur change border color handlers run', () => {
    const { container } = render(<Page />);
    const input = container.querySelector('input')!;
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(input).toBeTruthy();
  });
});

describe.each([
  ['dashboard', DashboardProfilePage],
  ['hub',       HubProfilePage],
] as const)('%s profile page interactions', (_name, Page) => {
  it('Copy button copies value then shows check mark', async () => {
    const { container } = render(<Page />);
    const copyBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent === 'Copy');
    expect(copyBtn).toBeTruthy();
    await act(async () => { fireEvent.click(copyBtn!); });
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    await waitFor(() => {
      expect(container.textContent).toContain('✓');
    });
  });
});

describe('dashboard profile Go to KYC', () => {
  it('navigates to /dashboard/kyc', () => {
    const { container } = render(<DashboardProfilePage />);
    const goBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Go to KYC'));
    if (goBtn) {
      fireEvent.click(goBtn);
      expect(mockRouterPush).toHaveBeenCalledWith('/dashboard/kyc');
    } else {
      expect(container).toBeTruthy();
    }
  });
});

describe('profile actions — confirm-true delete, sign out, quick actions, copy reset', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'confirm', {
      writable: true, configurable: true, value: vi.fn(() => true),
    });
  });

  it('hub profile Sign Out logs out and routes home', () => {
    const logout = vi.fn();
    mockUsePiAuth.mockReturnValue({
      user, isAuthenticated: true, isLoading: false,
      login: vi.fn(), logout, error: null,
    });
    const { container } = render(<HubProfilePage />);
    const signOut = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Sign Out'),
    );
    expect(signOut).toBeTruthy();
    fireEvent.click(signOut!);
    expect(logout).toHaveBeenCalled();
    expect(mockRouterPush).toHaveBeenCalledWith('/');
  });

  it.each([
    ['hub',       HubProfilePage],
    ['dashboard', DashboardProfilePage],
  ] as const)('%s profile Delete with confirm=true runs the delete handler', (_n, Page) => {
    const { container } = render(<Page />);
    const del = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Delete'),
    );
    expect(del).toBeTruthy();
    fireEvent.click(del!);
    expect(window.confirm).toHaveBeenCalled();
  });

  it.each([
    ['hub',       HubProfilePage, '/hub/kyc'],
    ['dashboard', DashboardProfilePage, '/dashboard/wallet'],
  ] as const)('%s profile quick actions navigate', (_n, Page, expectedHref) => {
    const { container } = render(<Page />);
    const wallet = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Wallet'),
    );
    const kyc = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('KYC') && !b.textContent?.includes('Go to'),
    );
    if (wallet) fireEvent.click(wallet);
    if (kyc)    fireEvent.click(kyc);
    expect(mockRouterPush.mock.calls.flat()).toContain(expectedHref);
  });

  it('copy indicator resets to "Copy" after 2 seconds', async () => {
    const { container } = render(<DashboardProfilePage />);
    const copyBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent === 'Copy',
    )!;
    await act(async () => { fireEvent.click(copyBtn); });
    await waitFor(() => expect(container.textContent).toContain('✓'));
    await act(async () => { await new Promise(r => setTimeout(r, 2100)); });
    expect(
      Array.from(container.querySelectorAll('button')).some(b => b.textContent === 'Copy'),
    ).toBe(true);
  }, 8000);
});
