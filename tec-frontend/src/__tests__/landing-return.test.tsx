/**
 * The landing page forwards a BOUNCED visitor — and nobody else.
 *
 * Reported from a phone: "the sign in with Pi page doesn't appear, it takes me
 * straight to the Hub." The cause was a fallback in my own previous change:
 *
 *     router.replace(takeReturn() ?? '/hub');
 *
 * `takeReturn()` is null for everyone who did not get bounced, so the `??`
 * turned a targeted fix into "no signed-in person may ever see this page" —
 * and this page carries the ecosystem list, the social links, and the sign-in
 * screen itself. The fix for a lost destination is not to remove one.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
// The REAL LocaleProvider, not a mocked dictionary — a mocked one would let a
// missing key pass, and this page is rendered in full here.
import { render, waitFor } from '@/test-utils/render-with-locale';

// `vi.hoisted` because vi.mock factories are lifted above every other
// statement in the file — a plain `const` above them is not yet initialised
// when they run, and the suite fails to load rather than failing an assertion.
const { mockReplace, mockUsePiAuth } = vi.hoisted(() => ({
  mockReplace:   vi.fn(),
  mockUsePiAuth: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
}));
vi.mock('@/lib-client/hooks/usePiAuth', () => ({ usePiAuth: mockUsePiAuth }));

vi.mock('@/components/LanguageSwitcher', () => ({ default: () => null }));
vi.mock('@/components/payment/PiPaymentButton', () => ({ default: () => null }));

import HomePage from '@/app/page';

const signedIn = { isAuthenticated: true,  isLoading: false };
const loading  = { isAuthenticated: false, isLoading: true  };

beforeEach(() => {
  mockReplace.mockClear();
  sessionStorage.clear();
  mockUsePiAuth.mockReturnValue(signedIn);
});

describe('the landing page stays reachable', () => {
  it('does NOT forward a signed-in visitor who arrived deliberately', async () => {
    // Nothing was remembered, so nothing was interrupted. Someone who typed
    // the address, or tapped the logo, asked to be here.
    render(<HomePage />);
    await waitFor(() => expect(mockReplace).not.toHaveBeenCalled());
  });

  it('does not forward while the session is still resolving', async () => {
    // In Pi Browser `/api/auth/me` takes a moment; acting on a half-known
    // state is how a page flickers to somewhere the user did not ask for.
    mockUsePiAuth.mockReturnValue(loading);
    sessionStorage.setItem('__tec_return_to', '/dashboard');
    render(<HomePage />);
    await waitFor(() => expect(mockReplace).not.toHaveBeenCalled());
  });
});

describe('a bounced visitor still gets carried back', () => {
  it('forwards to the remembered screen', async () => {
    sessionStorage.setItem('__tec_return_to', '/dashboard/wallet');
    render(<HomePage />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard/wallet'));
  });

  it('refuses a remembered value that is not a same-origin path', async () => {
    // Storage is a convenience, not a trust boundary — `//evil.com` starts
    // with "/" and browsers treat it as external.
    sessionStorage.setItem('__tec_return_to', '//evil.com');
    render(<HomePage />);
    await waitFor(() => expect(mockReplace).not.toHaveBeenCalled());
  });
});
