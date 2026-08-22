/**
 * The assistant button stays, and it holds still.
 *
 * It carried `tec-float` — `animation: … infinite` — so a 52px circle bobbed up
 * and down forever in the corner of every Hub screen. That is what "the button
 * that goes up and down" meant. The bob is gone; the button is not.
 *
 * (I removed the button itself for one release, reading "the Hub's scroll button"
 * as this. It was the painted scrollbar down the side of the screen. Restored.)
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
  it('is there', async () => {
    await renderHub();
    expect(screen.getByLabelText(en.hub.ai.open)).toBeTruthy();
  });

  it('holds still — no perpetual animation anywhere on the page', async () => {
    await renderHub();
    expect(document.querySelectorAll('.tec-float')).toHaveLength(0);
  });

  it('opens the drawer', async () => {
    await renderHub();
    await act(async () => { fireEvent.click(screen.getByLabelText(en.hub.ai.open)); });
    expect(screen.queryByLabelText(en.hub.ai.open)).toBeNull();
  });
});
