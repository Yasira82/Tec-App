/**
 * The assistant button must not fight the reader.
 *
 * It is a 52px fixed circle in the lower corner — exactly where a thumb starts a
 * scroll. It also carried `tec-float`, an `infinite` bob: permanent motion in the
 * corner of the screen with no way to stop it. Reported twice, first as "the
 * button that goes up and down" and then as "it's annoying when I want to
 * scroll".
 *
 * So: it holds still, and it yields — visually AND to the touch — while the page
 * is moving.
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

describe('the Hub assistant button', () => {
  it('does not bob — no infinite animation class', async () => {
    await renderHub();
    expect(fab().className).not.toMatch(/tec-float/);
  });

  it('is visible and tappable when the page is still', async () => {
    await renderHub();
    expect(fab().style.opacity).toBe('1');
    expect(fab().style.pointerEvents).toBe('auto');
  });

  it('gets out of the way while the page is scrolling', async () => {
    await renderHub();
    await act(async () => { fireEvent.scroll(window); });
    // Not just faded: a swipe that STARTS on it has to scroll the page, which
    // means the element cannot be taking the touch.
    expect(fab().style.opacity).toBe('0');
    expect(fab().style.pointerEvents).toBe('none');
    expect(fab().getAttribute('aria-hidden')).toBe('true');
  });

  it('comes back shortly after the scrolling stops', async () => {
    await renderHub();
    await act(async () => { fireEvent.scroll(window); });
    expect(fab().style.opacity).toBe('0');

    await act(async () => { vi.advanceTimersByTime(500); });
    expect(fab().style.opacity).toBe('1');
    expect(fab().style.pointerEvents).toBe('auto');
  });

  it('stays hidden while the scroll continues, instead of flickering back', async () => {
    await renderHub();
    await act(async () => { fireEvent.scroll(window); });
    for (let i = 0; i < 4; i++) {
      await act(async () => { vi.advanceTimersByTime(300); fireEvent.scroll(window); });
      expect(fab().style.opacity, `tick ${i}`).toBe('0');
    }
  });
});
