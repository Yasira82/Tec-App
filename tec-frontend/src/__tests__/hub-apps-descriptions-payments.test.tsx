/**
 * Three Hub suggestions (owner, 2026-10-05):
 *
 *   1. what each app is for, under its name — a List view beside the Grid;
 *   2. the last Pi payments on the wallet card, each named by its app;
 *   3. search — shown as a list, so a match on the description shows it.
 *
 * The rules pinned here are the ones a refactor would quietly break: the view
 * survives a reload; a payment whose app we cannot name says "Pi payment",
 * never a raw slug; an unknown status is never shown as completed; and the
 * payments section is absent until the history loads, so a failed request
 * cannot read as "you have paid nothing".
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test-utils/render-with-locale';
import { renderHook } from '@testing-library/react';
import { HubAppsGrid } from '@/components/hub/HubAppsGrid';
import { HubWalletCard } from '@/components/hub/HubWalletCard';
import { paymentAppName, paymentKind } from '@/lib/hub/payment-app';
import { normalizePayment, type Payment } from '@/lib/dashboard-data';
import { en } from '@/lib/i18n/en';
import { ar } from '@/lib/i18n/ar';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('@/lib/hub/utils', () => ({ haptic: vi.fn() }));
vi.mock('@/lib-client/pi/pi-auth', () => ({
  getAccessToken: vi.fn(() => 'tok'),
  getStoredUser:  vi.fn(),
  loginWithPi:    vi.fn(),
  logout:         vi.fn(),
  isPiBrowser:    vi.fn(() => false),
  fetchWithAuth:  vi.fn((url: string, opts?: RequestInit) => (global.fetch as typeof fetch)(url, opts)),
}));

import { useHubData } from '@/hooks/useHubData';

const APPS = [
  { slug: 'assets',   name: 'Assets',   desc: 'Own and trade digital assets', href: '/assets',   emoji: '', group: '' },
  { slug: 'commerce', name: 'Commerce', desc: 'Run your shop in Pi',          href: '/commerce', emoji: '', group: '' },
];

beforeEach(() => { localStorage.clear(); });

describe('apps — list view shows what each app is for', () => {
  it('the grid shows names only', () => {
    render(<HubAppsGrid apps={APPS} />);
    expect(screen.getByText('Assets')).toBeTruthy();
    expect(screen.queryByText('Own and trade digital assets')).toBeNull();
  });

  it('List shows the description under every name, and the choice survives a reload', () => {
    const { unmount } = render(<HubAppsGrid apps={APPS} />);
    fireEvent.click(screen.getByRole('button', { name: en.hub.apps.showList }));
    expect(screen.getByText('Own and trade digital assets')).toBeTruthy();
    expect(screen.getByText('Run your shop in Pi')).toBeTruthy();
    expect(localStorage.getItem('tec_apps_view')).toBe('list');
    unmount();

    render(<HubAppsGrid apps={APPS} />);
    expect(screen.getByText('Own and trade digital assets')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.hub.apps.showGrid }));
    expect(screen.queryByText('Own and trade digital assets')).toBeNull();
  });

  it('search results are a list, so a match on the description shows it', () => {
    render(<HubAppsGrid apps={APPS} />);
    fireEvent.change(screen.getByLabelText(en.hub.apps.search), { target: { value: 'shop' } });
    expect(screen.getByText('Commerce')).toBeTruthy();
    expect(screen.getByText('Run your shop in Pi')).toBeTruthy();
    expect(screen.queryByText('Assets')).toBeNull();
  });

  it('the toggle is translated', () => {
    render(<HubAppsGrid apps={APPS} />, { locale: 'ar' });
    expect(screen.getByRole('button', { name: ar.hub.apps.showList }).textContent).toBe(ar.hub.apps.list);
  });
});

describe('which app a payment was for', () => {
  it('names a registry app, and the Hub under either slug', () => {
    expect(paymentAppName('ecommerce', 'en')).toBeTruthy();
    expect(paymentAppName('ECOMMERCE', 'en')).toBe(paymentAppName('ecommerce', 'en'));
    expect(paymentAppName('hub', 'en')).toBe(paymentAppName('tec', 'en'));
  });

  it('never shows a slug it cannot stand behind', () => {
    expect(paymentAppName('not-an-app', 'en')).toBeNull();
    expect(paymentAppName(undefined, 'en')).toBeNull();
    expect(paymentAppName('', 'en')).toBeNull();
  });

  it('an unknown status is pending, never completed', () => {
    expect(paymentKind('COMPLETED')).toBe('completed');
    expect(paymentKind('created')).toBe('pending');
    expect(paymentKind('approved')).toBe('pending');
    expect(paymentKind('canceled')).toBe('cancelled');
    expect(paymentKind('failed')).toBe('failed');
    expect(paymentKind('something-new')).toBe('pending');
  });

  it('the parser reads source, or app_source', () => {
    expect(normalizePayment({ id: 'a', source: 'Life' }).source).toBe('life');
    expect(normalizePayment({ id: 'b', app_source: 'zone' }).source).toBe('zone');
    expect(normalizePayment({ id: 'c', source: null }).source).toBeUndefined();
  });
});

describe('wallet card — recent payments', () => {
  const pay = (over: Partial<Payment>): Payment => ({
    id: 'p', amount: 1, status: 'completed', type: 'payment', createdAt: '2026-10-05T10:00:00Z', ...over,
  });

  it('is absent until the history has loaded', () => {
    render(<HubWalletCard balance="1.00" piPrice={null} recent={null} />);
    expect(screen.queryByText(en.hub.wallet.recentTitle)).toBeNull();
  });

  it('says so when there are none', () => {
    render(<HubWalletCard balance="1.00" piPrice={null} recent={[]} />);
    expect(screen.getByText(en.hub.wallet.recentEmpty)).toBeTruthy();
  });

  it('names each payment by its app, with the amount and where it stands', () => {
    render(<HubWalletCard balance="1.00" piPrice={null} recent={[
      pay({ id: '1', source: 'ecommerce', amount: 2.5 }),
      pay({ id: '2', source: 'mystery', status: 'created' }),
      pay({ id: '3', status: 'failed' }),
    ]} />);
    expect(screen.getByText(paymentAppName('ecommerce', 'en')!)).toBeTruthy();
    expect(screen.getAllByText(en.hub.wallet.paymentGeneric)).toHaveLength(2);
    expect(screen.getByText('2.50 π')).toBeTruthy();
    expect(screen.getByText(en.hub.wallet.status.completed)).toBeTruthy();
    expect(screen.getByText(en.hub.wallet.status.pending)).toBeTruthy();
    expect(screen.getByText(en.hub.wallet.status.failed)).toBeTruthy();
  });

  it('reads in Arabic', () => {
    render(<HubWalletCard balance="1.00" piPrice={null} recent={[pay({ source: 'life' })]} />, { locale: 'ar' });
    expect(screen.getByText(ar.hub.wallet.recentTitle)).toBeTruthy();
    expect(screen.getByText(paymentAppName('life', 'ar')!)).toBeTruthy();
    expect(screen.getByText(ar.hub.wallet.status.completed)).toBeTruthy();
  });
});

describe('useHubData — recent payments', () => {
  it('loads the last 3 from the BFF history route', async () => {
    global.fetch = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => String(url).includes('/payments/history')
        ? { success: true, data: { payments: [
            { id: 'x', amount: '1', status: 'completed', created_at: '2026-10-05T00:00:00Z', source: 'zone' },
          ] } }
        : { balance: '1' },
    })) as any;
    const { result } = renderHook(() => useHubData('user-1'));
    await waitFor(() => expect(result.current.recentPayments).not.toBeNull());
    expect(result.current.recentPayments![0]).toMatchObject({ id: 'x', source: 'zone', status: 'completed' });
    const urls = (global.fetch as any).mock.calls.map((c: unknown[]) => String(c[0]));
    expect(urls.some((u: string) => u.includes('/api/bff/payments/history?limit=3'))).toBe(true);
  });

  it('stays null when the history fails — no fabricated empty list', async () => {
    global.fetch = vi.fn(async (url: string) => String(url).includes('/payments/history')
      ? { ok: false, status: 502, json: async () => ({}) }
      : { ok: true, json: async () => ({ balance: '1' }) }) as any;
    const { result } = renderHook(() => useHubData('user-1'));
    await waitFor(() => expect(result.current.balance).toBe('1.00'));
    expect(result.current.recentPayments).toBeNull();
  });
});
