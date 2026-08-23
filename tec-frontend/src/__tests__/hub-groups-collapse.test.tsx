/**
 * Seven groups and 23 apps made the launcher roughly four screens tall, so the
 * last group was only ever reached by scrolling past every other one. Groups
 * now open and close.
 *
 * The assertions here are the ones a careless refactor would break: that a
 * closed group still SAYS how many apps it holds (otherwise closing it hides
 * information rather than noise), that the choice survives a reload, that a
 * group nobody has an opinion about ships OPEN, and that searching overrides
 * the whole thing — a result hidden inside a collapsed group is a search that
 * silently lies about having found nothing.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@/test-utils/render-with-locale';
import { HubAppsGrid } from '@/components/hub/HubAppsGrid';
import { en } from '@/lib/i18n/en';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('@/lib/hub/utils', () => ({ haptic: vi.fn() }));

/** Real slugs, so the real CATEGORY_OF map does the grouping. */
const APPS = [
  { slug: 'assets',    name: 'Assets',    desc: 'Digital assets', href: '/assets',    emoji: '', group: '' },
  { slug: 'commerce',  name: 'Commerce',  desc: 'Merchants',      href: '/commerce',  emoji: '', group: '' },
  { slug: 'nbf',       name: 'NBF',       desc: 'Business',       href: '/nbf',       emoji: '', group: '' },
  { slug: 'dx',        name: 'DX',        desc: 'Developers',     href: '/dx',        emoji: '', group: '' },
];

const KEY = 'tec_collapsed_groups';

beforeEach(() => { localStorage.clear(); });

/** The clickable heading for a group, by its visible label. */
const heading = (label: string) =>
  screen.getAllByRole('button').find(b => b.textContent?.startsWith(label))!;

describe('a group opens and closes', () => {
  it('ships OPEN when nobody has expressed a preference', () => {
    render(<HubAppsGrid apps={APPS} />);
    expect(screen.getByText('Assets')).toBeTruthy();
    expect(heading('Money')).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes on click and hides only its own apps', () => {
    render(<HubAppsGrid apps={APPS} />);
    fireEvent.click(heading('Money'));
    expect(screen.queryByText('Assets')).toBeNull();
    // The other group is untouched — closing one must not close the page.
    expect(screen.getByText('NBF')).toBeTruthy();
  });

  it('still says how many apps are inside when closed', () => {
    // A closed group that shows nothing but a title has hidden information,
    // not noise. The count is what makes it safe to close.
    render(<HubAppsGrid apps={APPS} />);
    const h = heading('Money');
    fireEvent.click(h);
    expect(within(h).getByText('2')).toBeTruthy();
  });

  it('remembers the choice across a reload', () => {
    const { unmount } = render(<HubAppsGrid apps={APPS} />);
    fireEvent.click(heading('Money'));
    expect(JSON.parse(localStorage.getItem(KEY)!)).toContain('money');
    unmount();

    render(<HubAppsGrid apps={APPS} />);
    expect(screen.queryByText('Assets')).toBeNull();
    expect(heading('Money')).toHaveAttribute('aria-expanded', 'false');
  });

  it('survives storage being blocked, without losing the toggle', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<HubAppsGrid apps={APPS} />);
    expect(() => fireEvent.click(heading('Money'))).not.toThrow();
    // It still closed — the choice just is not remembered.
    expect(screen.queryByText('Assets')).toBeNull();
    spy.mockRestore();
  });
});

describe('search overrides the state', () => {
  it('shows a match that lives in a collapsed group', () => {
    // Otherwise the search reports nothing while the answer sits one click
    // away inside a group the reader closed last week.
    localStorage.setItem(KEY, JSON.stringify(['money', 'business']));
    render(<HubAppsGrid apps={APPS} />);
    expect(screen.queryByText('Assets')).toBeNull();

    fireEvent.change(screen.getByPlaceholderText(en.hub.apps.search), { target: { value: 'assets' } });
    expect(screen.getByText('Assets')).toBeTruthy();
  });

  it('goes back to the remembered state when the query is cleared', () => {
    localStorage.setItem(KEY, JSON.stringify(['money']));
    render(<HubAppsGrid apps={APPS} />);
    const box = screen.getByPlaceholderText(en.hub.apps.search);
    fireEvent.change(box, { target: { value: 'assets' } });
    expect(screen.getByText('Assets')).toBeTruthy();
    fireEvent.change(box, { target: { value: '' } });
    expect(screen.queryByText('Assets')).toBeNull();
  });
});

describe('a preference cannot hide a group that did not exist yet', () => {
  it('treats an unknown group as open', () => {
    // The stored value is a list of CLOSED groups, not open ones. A new
    // category therefore ships visible instead of being hidden by a
    // preference set before it was written.
    localStorage.setItem(KEY, JSON.stringify(['some-old-group']));
    render(<HubAppsGrid apps={APPS} />);
    expect(screen.getByText('Assets')).toBeTruthy();
    expect(screen.getByText('NBF')).toBeTruthy();
  });

  it('ignores junk in storage rather than trusting it', () => {
    localStorage.setItem(KEY, '{"not":"an array"}');
    render(<HubAppsGrid apps={APPS} />);
    expect(screen.getByText('Assets')).toBeTruthy();
  });
});
