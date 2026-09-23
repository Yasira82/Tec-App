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

  it('shows the derived total in the completion banner when the SERVER says so', async () => {
    // N must equal the derived total, not a literal 24 — and the banner must come
    // from `completed_at`, the server's own verdict.
    global.fetch = mockFetch(
      { opened_apps: LIVE_DOMAINS.map((d) => d.slug), completed_at: '2026-09-19T00:00:00Z' },
      null,
    ) as unknown as typeof fetch;
    let container!: HTMLElement;
    await act(async () => { ({ container } = render(<PioneersClient />)); });
    await waitFor(() => {
      expect(container.textContent).toContain(`you opened all ${TOTAL}`);
    });
    expect(container.textContent).toContain('100%');
  });

  it('does NOT promise the badge when only local storage says the quest is done', async () => {
    // The defect this pins: a failed `/open` POST leaves its tick in localStorage,
    // the server merge is a union that only adds, and the ✓ is what stops the
    // person tapping again — so the local count can sit permanently ahead of the
    // truth. The bar may run ahead; the promise may not.
    localStorage.setItem(
      'tec_pioneer_quest',
      JSON.stringify(LIVE_DOMAINS.map((d) => d.slug)),
    );
    // Server has nothing: no quest row at all.
    let container!: HTMLElement;
    await act(async () => { ({ container } = render(<PioneersClient />)); });
    await waitFor(() => {
      expect(container.textContent).toContain('100%');
    });
    expect(container.textContent).not.toContain('you opened all');
    expect(container.textContent).not.toContain('You qualify');
  });

  it('re-sends a tick the server never received', async () => {
    // The set difference between local and server IS the list to re-send. Without
    // it a tick lost to a backend blip stays local forever and the quest silently
    // never completes.
    const slugs = LIVE_DOMAINS.map((d) => d.slug);
    localStorage.setItem('tec_pioneer_quest', JSON.stringify(slugs));
    const fetchMock = mockFetch({ opened_apps: slugs.slice(0, -1) }, null);
    global.fetch = fetchMock as unknown as typeof fetch;
    await act(async () => { render(<PioneersClient />); });
    await waitFor(() => {
      const opens = fetchMock.mock.calls
        .map((c) => String(c[0]))
        .filter((u) => u.includes('/pioneer/open'));
      expect(opens).toHaveLength(1);
    });
  });

  it('takes the Quest target from the server, not from what is live', async () => {
    // A frozen campaign roster of 20 against 24 live apps: the page must ask for
    // the campaign's 20 and still list all 24.
    global.fetch = mockFetch(null, {
      founding_claimed: 0, founding_remaining: 100,
      total_pioneers: 0, completed: 0, quest_target: 20,
    }) as unknown as typeof fetch;
    localStorage.setItem(
      'tec_pioneer_quest',
      JSON.stringify(LIVE_DOMAINS.slice(0, 20).map((d) => d.slug)),
    );
    let container!: HTMLElement;
    await act(async () => { ({ container } = render(<PioneersClient />)); });
    await waitFor(() => {
      expect(container.textContent).toContain('20 of 20 explored');
    });
    // The grid still lists every live app.
    expect(container.textContent).toContain(`Explore the ${TOTAL} apps`);
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

  it('hides the counter from a visitor even when the cohort is large', async () => {
    // ── A reversal of the assertion this test used to make ──────────────────
    // It pinned the counter OPENING to the public above a floor of 10 claimed,
    // on the argument that scarcity converts. The argument was fine; the
    // numbers are not scarcity. At 6 of 100 — several of them the owner's own
    // test accounts — a cold visitor reads the counter as an empty room.
    //
    // So it is owner-only with no threshold and no path to opening. 73 is used
    // here precisely because the old rule would have shown it.
    mockUsePiAuth.mockReturnValue(anon);
    delete process.env.NEXT_PUBLIC_PIONEER_ADMINS;
    global.fetch = mockFetch(null, {
      founding_claimed: 73, founding_remaining: 27,
      total_pioneers: 140, completed: 73,
    }) as unknown as typeof fetch;
    let container!: HTMLElement;
    await act(async () => { ({ container } = render(<PioneersClient />)); });
    await waitFor(() => {
      expect(container.textContent).toContain('Founding 100');
    });
    expect(container.textContent).not.toContain('Founding spots claimed');
    expect(container.textContent).not.toContain('Pioneers joined');
  });

  it('still hides an EMPTY counter from a visitor — an early zero argues against the page', async () => {
    mockUsePiAuth.mockReturnValue(anon);
    delete process.env.NEXT_PUBLIC_PIONEER_ADMINS;
    global.fetch = mockFetch(null, {
      founding_claimed: 0, founding_remaining: 100,
      total_pioneers: 0, completed: 0,
    }) as unknown as typeof fetch;
    let container!: HTMLElement;
    await act(async () => { ({ container } = render(<PioneersClient />)); });
    await waitFor(() => {
      expect(container.textContent).toContain('Founding 100');
    });
    expect(container.textContent).not.toContain('Founding spots claimed');
    expect(container.textContent).not.toContain('Pioneers joined');
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
      {
        opened_apps: LIVE_DOMAINS.map((d) => d.slug),
        founding_number: 7,
        // A quest that earned a number is a completed quest — the server says so
        // with `completed_at`, and that is what the banner reads.
        completed_at: '2026-09-19T00:00:00Z',
        kyc_verified: true,
      },
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

/**
 * The PRO link appears only once the PRO exists.
 *
 * The Founding gift is a separate call to a separate service, and it could fail
 * while the Founding number stood. The page showed "See your 6 months of PRO"
 * the moment a number did — so a brand-new Founding Pioneer tapped it and found
 * a FREE plan. That is the screen where somebody decides the campaign was a lie.
 *
 * The service now retries the gift on this very read and says whether it has
 * landed. The page believes it.
 */
describe('PioneersClient — the PRO link waits for the PRO', () => {
  const withGift = (founding_gift: unknown) => vi.fn((url: string) => {
    const u = String(url);
    if (u.includes('/pioneer/me')) {
      return Promise.resolve({ ok: true, json: async () => ({
        data: { quest: { opened_apps: [], founding_number: 7, completed_at: '2026-09-20' }, founding_gift },
      }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({ data: {} }) });
  });

  it('holds the link back while commerce has not confirmed the gift', async () => {
    global.fetch = withGift('pending') as unknown as typeof fetch;
    let container!: HTMLElement;
    await act(async () => { ({ container } = render(<PioneersClient />)); });
    await waitFor(() => expect(container.textContent).toContain('Founding Pioneer #7'));
    expect(container.textContent).toContain('being activated');
    expect(container.querySelector('a[href="/hub/subscription"]')).toBeNull();
  });

  it('shows the link once the gift is confirmed', async () => {
    global.fetch = withGift('granted') as unknown as typeof fetch;
    let container!: HTMLElement;
    await act(async () => { ({ container } = render(<PioneersClient />)); });
    await waitFor(() => expect(container.querySelector('a[href="/hub/subscription"]')).not.toBeNull());
    expect(container.textContent).not.toContain('being activated');
  });

  it('keeps the old behaviour when an older service does not say', async () => {
    // Rolling out, the Hub may deploy before identity-service does. An absent
    // field must not strand every Founding member on "being activated".
    global.fetch = withGift(undefined) as unknown as typeof fetch;
    let container!: HTMLElement;
    await act(async () => { ({ container } = render(<PioneersClient />)); });
    await waitFor(() => expect(container.querySelector('a[href="/hub/subscription"]')).not.toBeNull());
  });
});
