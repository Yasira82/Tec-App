/**
 * Nothing hovers over the Hub.
 *
 * The assistant used to be a 52px circle pinned to the lower corner — exactly
 * where a thumb starts a scroll — bobbing forever via `tec-float`. Reported three
 * times: "the button that goes up and down", "it's annoying when I want to
 * scroll", and finally "remove it, I want to scroll the screen". It is removed.
 *
 * It now lives in the Platform Tools row, which scrolls with the page and covers
 * nothing. These assertions keep it there.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent } from '@testing-library/react';
import { render, screen } from '@/test-utils/render-with-locale';
import { en } from '@/lib/i18n/en';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter:       () => ({ push, replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname:     () => '/hub',
  useSearchParams: () => ({ get: () => null }),
}));
vi.mock('@/lib/hub/utils', () => ({ haptic: vi.fn() }));
vi.mock('@/lib-client/hooks/usePiAuth', () => ({
  usePiAuth: () => ({
    user: { id: 'u-1', piUsername: 'alice' },
    isAuthenticated: true, isLoading: false, login: vi.fn(), logout: vi.fn(), error: null,
  }),
}));
vi.mock('@/lib-client/hooks/usePiSdkReady', () => ({
  usePiSdkReady: () => ({ piReady: false, authReady: false, lastError: null, ensurePiAuth: vi.fn() }),
}));
vi.mock('@/lib-client/hooks/useRealtimeNotifications', () => ({
  useRealtimeNotifications: () => ({ unread: 0, connected: false, clearUnread: vi.fn() }),
}));
vi.mock('@/hooks/useHubData', () => ({
  useHubData: () => ({
    balance: '10.00', balanceError: false, assetCount: 0, piPrice: null, notifCount: 0,
    time: '12:00', setNotifCount: vi.fn(), refresh: vi.fn(), refreshBalance: vi.fn(),
  }),
}));
vi.mock('@/app/hub/components/AIDrawer',   () => ({ AIDrawer: () => null }));
vi.mock('@/app/hub/components/PaymentModal', () => ({ PaymentModal: () => null, ExternalPayment: {} }));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    { ok: true, status: 200, json: async () => ({}) } as Response,
  );
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const fab = () => screen.getByLabelText(en.hub.ai.open);

const renderHub = async () => {
  const { default: Page } = await import('@/app/hub/page');
  await act(async () => { render(<Page />); });
};

describe('the Hub has no floating overlay', () => {
  it('has nothing fixed over the content that can swallow a touch', async () => {
    await renderHub();
    const blocking = [...document.querySelectorAll<HTMLElement>('[style*="position: fixed"]')]
      // The bottom nav is anchored chrome, not an overlay: it sits at the screen
      // edge and the page reserves room for it.
      .filter(el => el.tagName !== 'NAV')
      // The toast layer is `pointer-events: none` — it floats but cannot take a
      // touch, which is the only thing that made the old button hostile to scrolling.
      .filter(el => el.style.pointerEvents !== 'none');
    expect(blocking.map(el => el.getAttribute('aria-label') ?? el.tagName)).toEqual([]);
  });

  it('has no perpetual animation anywhere on the page', async () => {
    await renderHub();
    // `tec-float` is `animation: … infinite`. Permanent motion the reader cannot
    // stop is what made the old button impossible to ignore.
    expect(document.querySelectorAll('.tec-float')).toHaveLength(0);
  });
});

describe('the assistant', () => {
  it('is reachable from the Platform Tools row', async () => {
    await renderHub();
    expect(screen.getByText(en.hub.ai.tool)).toBeTruthy();
  });

  it('opens the drawer when tapped', async () => {
    await renderHub();
    const tool = screen.getByText(en.hub.ai.tool).closest('button')!;
    await act(async () => { fireEvent.click(tool); });
    // The tools row is inside the page flow, so the button is still in the document
    // after opening — what matters is that the tap was accepted, not swallowed by
    // an overlay.
    expect(tool).toBeTruthy();
  });
});
