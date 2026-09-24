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
import { render, waitFor, screen } from '@/test-utils/render-with-locale';

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
vi.mock('@/components/payment/PiPaymentButton', () => ({ default: () => <span>SIGN-IN-BUTTON</span> }));

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
    sessionStorage.setItem('__tec_return_to', `/dashboard|${Date.now()}`);
    render(<HomePage />);
    await waitFor(() => expect(mockReplace).not.toHaveBeenCalled());
  });
});

describe('a bounced visitor still gets carried back', () => {
  it('forwards to the remembered screen', async () => {
    sessionStorage.setItem('__tec_return_to', `/dashboard/wallet|${Date.now()}`);
    render(<HomePage />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard/wallet'));
  });

  it('refuses a remembered value that is not a same-origin path', async () => {
    // Storage is a convenience, not a trust boundary — `//evil.com` starts
    // with "/" and browsers treat it as external.
    sessionStorage.setItem('__tec_return_to', `//evil.com|${Date.now()}`);
    render(<HomePage />);
    await waitFor(() => expect(mockReplace).not.toHaveBeenCalled());
  });
});

describe('back from an app: the page it was tapped from, then the Hub', () => {
  // Reported from a phone: back from an app opened on the Quest landed on the
  // Quest — and the NEXT back went to the campaign, or somewhere else each
  // time. The landing page replaced itself with the Quest, so what sat behind
  // it was whatever the SSO chain left in history.
  it.each(['/pioneers', '/hub/campaign'])('goes to the Hub first and stages %s on top', async (dest) => {
    sessionStorage.setItem('__tec_return_to', `${dest}|${Date.now()}`);
    render(<HomePage />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/hub'));
    expect(mockReplace).not.toHaveBeenCalledWith(dest);
    expect(sessionStorage.getItem('__tec_return_onward')?.startsWith(`${dest}|`)).toBe(true);
  });

  it('ignores a destination left over from an old trip', async () => {
    // A campaign tap nobody came back through, still sitting there an hour later.
    sessionStorage.setItem('__tec_return_to', `/hub/campaign|${Date.now() - 60 * 60 * 1000}`);
    render(<HomePage />);
    await waitFor(() => expect(mockReplace).not.toHaveBeenCalled());
    expect(sessionStorage.getItem('__tec_return_onward')).toBeNull();
  });
});

describe('a signed-in visitor is not asked to sign in', () => {
  // Reached by back from the Quest, this page offered "Sign in with Pi" to a
  // person who was signed in — it read as "you were logged out". Seen on a
  // phone, 2026-09-24. The page stays reachable; it just says the true thing.
  it('offers the Hub instead of the sign-in button', () => {
    render(<HomePage />);
    expect(screen.getByText('Open the Hub →').closest('a')?.getAttribute('href')).toBe('/hub');
    expect(screen.queryByText('SIGN-IN-BUTTON')).toBeNull();
  });

  it('still shows the sign-in button to a visitor who is not signed in', () => {
    mockUsePiAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
    render(<HomePage />);
    expect(screen.getByText('SIGN-IN-BUTTON')).toBeInTheDocument();
    expect(screen.queryByText('Open the Hub →')).toBeNull();
  });
});
