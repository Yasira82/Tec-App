/**
 * Coverage for the public Pioneer campaign:
 *   app/pioneers/page.tsx          — metadata count derives from the LIVE registry
 *   app/pioneers/PioneersClient.tsx — quest gating, derived counts (no hard-coded 24),
 *                                     opened-app tracking, and the public Founding counter.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act, fireEvent, waitFor } from '@testing-library/react';

const mockUsePiAuth = vi.hoisted(() => vi.fn());

vi.mock('@/lib-client/hooks/usePiAuth', () => ({ usePiAuth: mockUsePiAuth }));

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ locale: 'en', dir: 'ltr', setLocale: vi.fn() }),
}));

vi.mock('@/components/LanguageSwitcher', () => ({
  default: () => <div data-testid="lang-switcher" />,
}));

// Real registry — the whole point is that the copy tracks LIVE_DOMAINS, so use it.
import { LIVE_DOMAINS } from '@/domains/_registry';
import PioneersClient from '@/app/pioneers/PioneersClient';
import { metadata } from '@/app/pioneers/page';

const TOTAL = LIVE_DOMAINS.length;

function mockFetch(quest: unknown = null, stats: unknown = null) {
  return vi.fn((url: string) => {
    const u = String(url);
    if (u.includes('/pioneer/stats')) {
      return Promise.resolve({ ok: !!stats, json: async () => ({ data: { stats } }) });
    }
    if (u.includes('/pioneer/me')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: { quest } }) });
    }
    // /pioneer/open
    return Promise.resolve({ ok: true, json: async () => ({ data: {} }) });
  });
}

const authed = {
  user: { id: 'u-1', piUsername: 'alice' },
  isAuthenticated: true, isLoading: false, login: vi.fn(), logout: vi.fn(), error: null,
};
const anon = {
  user: null, isAuthenticated: false, isLoading: false, login: vi.fn(), logout: vi.fn(), error: null,
};

beforeEach(() => {
  localStorage.clear();
  mockUsePiAuth.mockReturnValue(authed);
  global.fetch = mockFetch() as unknown as typeof fetch;
  // The live counter is owner-only; the mocked authed user ('alice') is the owner.
  process.env.NEXT_PUBLIC_PIONEER_ADMINS = 'alice';
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.NEXT_PUBLIC_PIONEER_ADMINS;
});

describe('pioneers page metadata', () => {
  it('derives the app count in the description from LIVE_DOMAINS (no hard-coded 24)', () => {
    expect(metadata.description).toContain(`${TOTAL} apps`);
  });
});

describe('PioneersClient — derived counts', () => {
  it('renders the LIVE app count in the apps title and the "N live" badge', async () => {
    let container!: HTMLElement;
    await act(async () => { ({ container } = render(<PioneersClient />)); });
    await waitFor(() => {
      expect(container.textContent).toContain(`Explore the ${TOTAL} apps`);
    });
    expect(container.textContent).toContain(`${TOTAL} live`);
  });

  it('shows the derived total in the completion banner when all apps are opened', async () => {
    // Pre-seed every live slug as visited — an authenticated visitor then sees the
    // "opened all N" banner, and N must equal the derived total, not a literal 24.
    localStorage.setItem(
      'tec_pioneer_quest',
      JSON.stringify(LIVE_DOMAINS.map((d) => d.slug)),
    );
    let container!: HTMLElement;
    await act(async () => { ({ container } = render(<PioneersClient />)); });
    await waitFor(() => {
      expect(container.textContent).toContain(`you opened all ${TOTAL}`);
    });
    expect(container.textContent).toContain('100%');
  });

  it('renders one anchor per live app', async () => {
    let container!: HTMLElement;
    await act(async () => { ({ container } = render(<PioneersClient />)); });
    // App links carry data-app; other anchors (FAQ, etc.) are excluded on purpose.
    const links = container.querySelectorAll('a[data-app]');
    expect(links.length).toBe(TOTAL);
  });
});

describe('PioneersClient — quest gating', () => {
  it('shows the login gate (not the progress bar) when logged out', async () => {
    mockUsePiAuth.mockReturnValue(anon);
    let container!: HTMLElement;
    await act(async () => { ({ container } = render(<PioneersClient />)); });
    await waitFor(() => {
      expect(container.textContent).toContain('Log in with your Pi account');
    });
    // Apps still browsable for everyone.
    expect(container.querySelectorAll('a[data-app]').length).toBe(TOTAL);
  });

  it('does NOT accrue progress or POST when a logged-out visitor taps an app', async () => {
    mockUsePiAuth.mockReturnValue(anon);
    let container!: HTMLElement;
    await act(async () => { ({ container } = render(<PioneersClient />)); });
    const link = container.querySelector('a[data-app]')!;
    await act(async () => { fireEvent.click(link); });
    expect(localStorage.getItem('tec_pioneer_quest')).toBeNull();
    const openCalls = (global.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .filter((c) => String(c[0]).includes('/pioneer/open'));
    expect(openCalls.length).toBe(0);
  });
});

describe('PioneersClient — opened-app tracking', () => {
  it('marks an app opened for an authenticated visitor: localStorage + best-effort POST', async () => {
    let container!: HTMLElement;
    await act(async () => { ({ container } = render(<PioneersClient />)); });
    const link = container.querySelector('a[data-app]')!;
    await act(async () => { fireEvent.click(link); });

    const stored = JSON.parse(localStorage.getItem('tec_pioneer_quest') ?? '[]');
    expect(stored).toContain(LIVE_DOMAINS[0].slug);

    await waitFor(() => {
      const openCalls = (global.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls
        .filter((c) => String(c[0]).includes('/pioneer/open'));
      expect(openCalls.length).toBe(1);
    });
    // The tapped app shows the "Explored" check.
    expect(container.textContent).toContain('Explored');
  });
});

describe('PioneersClient — Founding counter', () => {
  it('renders the live Founding counter from the public stats endpoint', async () => {
    global.fetch = mockFetch(null, { founding_claimed: 42, founding_remaining: 58 }) as unknown as typeof fetch;
    let container!: HTMLElement;
    await act(async () => { ({ container } = render(<PioneersClient />)); });
    await waitFor(() => {
      expect(container.textContent).toContain('42 of 100 Founding spots claimed');
    });
    expect(container.textContent).toContain('58 left');
  });

  it('renders the real live counters (pioneers joined + completed) from stats', async () => {
    global.fetch = mockFetch(null, {
      founding_claimed: 3, founding_remaining: 97, total_pioneers: 128, completed: 11,
    }) as unknown as typeof fetch;
    let container!: HTMLElement;
    await act(async () => { ({ container } = render(<PioneersClient />)); });
    await waitFor(() => { expect(container.textContent).toContain('Pioneers joined'); });
    expect(container.textContent).toContain('128');
    expect(container.textContent).toContain('Completed the Quest');
    expect(container.textContent).toContain('11');
  });

  it('shows an honest zero (not a fabricated number) when no pioneers have joined', async () => {
    global.fetch = mockFetch(null, {
      founding_claimed: 0, founding_remaining: 100, total_pioneers: 0, completed: 0,
    }) as unknown as typeof fetch;
    let container!: HTMLElement;
    await act(async () => { ({ container } = render(<PioneersClient />)); });
    await waitFor(() => { expect(container.textContent).toContain('Pioneers joined'); });
    // Real zero is shown — the honesty rule (C-133 §7): never a fake starter number.
    const joinedCell = Array.from(container.querySelectorAll('div'))
      .find((el) => el.textContent?.trim() === 'Pioneers joined')?.previousElementSibling;
    expect(joinedCell?.textContent).toBe('0');
  });

  it('hides the live counter from a non-owner visitor (owner-only)', async () => {
    // A logged-in user who is NOT in NEXT_PUBLIC_PIONEER_ADMINS must not see the
    // aggregate counter — cold campaign traffic never sees the early zeros.
    process.env.NEXT_PUBLIC_PIONEER_ADMINS = 'someone-else';
    global.fetch = mockFetch(null, {
      founding_claimed: 3, founding_remaining: 97, total_pioneers: 128, completed: 11,
    }) as unknown as typeof fetch;
    let container!: HTMLElement;
    await act(async () => { ({ container } = render(<PioneersClient />)); });
    await waitFor(() => { expect(container.textContent).toContain('Your Pioneer Quest'); });
    expect(container.textContent).not.toContain('Pioneers joined');
    expect(container.textContent).not.toContain('Completed the Quest');
  });

  it('merges server-side opened apps and shows the Founding number badge', async () => {
    global.fetch = mockFetch(
      { opened_apps: LIVE_DOMAINS.map((d) => d.slug), founding_number: 7, kyc_verified: true },
      null,
    ) as unknown as typeof fetch;
    let container!: HTMLElement;
    await act(async () => { ({ container } = render(<PioneersClient />)); });
    await waitFor(() => {
      expect(container.textContent).toContain('You are Founding Pioneer #7');
    });
    // Server quest completes the bar → derived total banner.
    expect(container.textContent).toContain(`you opened all ${TOTAL}`);
  });
});
