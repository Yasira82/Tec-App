/**
 * Extended tests for HomePage (src/app/page.tsx)
 * Targets: category filter, search, openApp, handleKey, Nexus button,
 *          no-results state, clear search, LTR/RTL direction, footer links.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

// ── Mocks ─────────────────────────────────────────────────────────

import { APPS, GROUPS } from '@/lib/apps';
import { getDomain } from '@/domains/_registry';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, className, 'aria-label': ariaLabel }: any) => (
    <a href={href} className={className} aria-label={ariaLabel}>{children}</a>
  ),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,
}));

vi.mock('@/components/LanguageSwitcher', () => ({
  default: () => <div data-testid="lang-switcher" />,
}));

vi.mock('@/components/payment/PiPaymentButton', () => ({
  default: () => <button data-testid="pi-pay-btn">Sign in with Pi</button>,
}));

// Module-level i18n mock with factory; default = LTR English
const mockUseTranslation = vi.fn();

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => mockUseTranslation(),
}));

// CSS modules
vi.mock('./page.module.css', () => ({ default: {} }));

const makeMockT = () => ({
  t: {
    common: {
      piEcosystem: 'Pi Ecosystem',
      appName:     'TEC App',
      tagline:     'The Elite Consortium',
      loading:     'Loading...',
      login:       'Login',
    },
    home: {
      description:     'Description text',
      subDescription:  'Sub description',
      ecosystem:       'Ecosystem',
      ecosystemTitle:  'Explore — the Apps',
      moreApps:        'More apps',
      stats: { apps: 'Apps', piUsers: 'Pi Users', identity: 'Identity' },
      trust: { free: 'Free', noPassphrase: 'No passphrase', noPurchase: 'No purchase', readOnly: 'Read only', official: 'Official' },
      install: { cta: 'Add TEC', sub: 'One tap', button: 'Install', openInBrowser: 'Open in browser', stepsTitle: 'Steps', step1: 'One', step2: 'Two', step3: 'Three', dismiss: 'Not now' },
        demo: { cta: 'Explore as guest', badge: 'Guest', title: 'T', subtitle: 'S', identityName: 'Demo', identityHandle: '@d', passport: 'P', appsLabel: 'A', identityLabel: 'I', walletLabel: 'W', sampleTag: 'S', doTitle: 'D', do1Title: '1', do1Desc: '1', do2Title: '2', do2Desc: '2', do3Title: '3', do3Desc: '3', signIn: 'Sign in', back: 'Back' },
    },
    dashboard: {
      piIntegration: { connectBtn: 'Connect with Pi' },
    },
    apps: {
      Nexus:    'TEC Nexus App',
      Commerce: 'Commerce App',
      Assets:   'Assets App',
      Fundx:    'Fundx App',
      Estate:   'Estate App',
      Analytics:'Analytics App',
      Life:     'Life App',
      Insure:   'Insure App',
      Ecommerce:'Ecommerce App',
      Dx:       'Dx App',
      Nbf:      'Nbf App',
      Epic:     'Epic App',
      Legend:   'Legend App',
      Connection:'Connection App',
      System:   'System App',
      Alert:    'Alert App',
      Tec:      'Tec App',
      Nx:       'Nx App',
      Explorer: 'Explorer App',
      Brookfield:'Brookfield App',
      Vip:      'Vip App',
      Titan:    'Titan App',
      Zone:     'Zone App',
      Elite:    'Elite App',
    },
  },
  language: 'en',
  dir:      'ltr',
  setLanguage: vi.fn(),
});

const makeMockTRtl = () => ({
  ...makeMockT(),
  language: 'ar',
  dir:      'rtl',
});

// Mock domains/_registry
// NOT mocked, deliberately. The landing grid's entire job is to render the real
// registry — the same one the signed-in Hub renders. Stubbing it out with empty
// arrays is what let this page drift onto a hand-typed app list for months while
// every test stayed green.

// Suppress CSS module warnings
vi.mock('@/app/page.module.css', () => ({ default: {} }));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseTranslation.mockReturnValue(makeMockT());

  // Default window.location mock
  Object.defineProperty(window, 'location', {
    value:       { href: '/', search: '' },
    writable:    true,
    configurable: true,
  });
  vi.spyOn(window, 'open').mockImplementation(() => null);
});

// ── Lazy import pattern (required by project conventions) ──────────
async function getPage() {
  const { default: HomePage } = await import('@/app/page');
  return HomePage;
}

// ─────────────────────────────────────────────────────────────────
// Basic render
// ─────────────────────────────────────────────────────────────────

/** Chips and app cards are both role=button and can share a name ("Commerce" is a
 *  group AND an app), so chip lookups are scoped to the labelled filter group. */
const chipIn = (label: string) =>
  within(screen.getByRole('group', { name: 'Filter apps' }))
    .getByRole('button', { name: new RegExp(`^${label}`) });

describe('HomePage — basic render', () => {
  it('renders the navbar logo', async () => {
    const HomePage = await getPage();
    const { container } = render(<HomePage />);
    // 'EC' appears in both navbar logo and footer logo
    const ecElements = container.querySelectorAll('span');
    const ecTexts = Array.from(ecElements).filter(el => el.textContent === 'EC');
    expect(ecTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('renders ecosystem nav link', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const links = screen.getAllByText('Ecosystem');
    expect(links.length).toBeGreaterThan(0);
  });

  it('renders hero stats section', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    // The count is DERIVED from the registry, so it cannot go stale the way a
    // typed "24" did. 47M+ is gone: that is Pi Network's population, and in TEC's
    // own stat row it read as TEC's userbase.
    expect(screen.getAllByText(String(APPS.length)).length).toBeGreaterThan(0);
    expect(screen.queryByText('47M+')).not.toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  it('renders hero sub text', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    expect(screen.getByText('Description text')).toBeInTheDocument();
  });

  it('renders PiPaymentButton in payment section', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    expect(screen.getByTestId('pi-pay-btn')).toBeInTheDocument();
  });

  it('renders best experience in Pi Browser tip', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    expect(screen.getByText(/Best experience in Pi Browser/)).toBeInTheDocument();
  });

  it('renders LanguageSwitcher', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    expect(screen.getByTestId('lang-switcher')).toBeInTheDocument();
  });

  it('renders footer copyright text', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it('renders footer Privacy link', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    expect(screen.getByText('Privacy')).toBeInTheDocument();
  });

  it('renders footer Terms link', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    expect(screen.getByText('Terms')).toBeInTheDocument();
  });

  it('renders floating AI button', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    expect(screen.getByLabelText('TEC Assistant')).toBeInTheDocument();
  });

  it('renders the /ai Assistant nav link', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const assistantLink = screen.getByText(/Assistant/);
    expect(assistantLink).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// Featured Nexus section
// ─────────────────────────────────────────────────────────────────
describe('HomePage — Featured Nexus section', () => {
  it('renders TEC Nexus heading', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    expect(screen.getByRole('heading', { level: 2, name: /TEC Nexus/ })).toBeInTheDocument();
  });

  it('describes Nexus from the registry, not a hand-typed string', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const nexus = getDomain('nexus')!;
    const copy  = (nexus.valueProp ?? nexus.description).en;
    expect(screen.getAllByText(copy).length).toBeGreaterThan(0);
  });

  it('never opens nexus.pi — that domain does not resolve yet', async () => {
    // The single call-to-action above the fold used to open `https://nexus.pi`,
    // a .pi address that is the FUTURE home of the app. A visitor's first tap
    // landed on nothing. Pre-login, every "open" goes to Sign in.
    const HomePage = await getPage();
    render(<HomePage />);
    fireEvent.click(screen.getByText('Explore Nexus →'));
    expect(window.open).not.toHaveBeenCalled();
    expect(String(window.location.hash)).toContain('payment');
  });

  it('RTL direction renders Arabic explore label', async () => {
    mockUseTranslation.mockReturnValue(makeMockTRtl());
    const HomePage = await getPage();
    render(<HomePage />);
    expect(screen.getByText(/استكشف Nexus/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// Category filter
// ─────────────────────────────────────────────────────────────────
describe('HomePage — group filter', () => {
  // The old filter was ten hand-typed categories that no longer matched the
  // registry: "Health" filtered to Dx (the DEVELOPER platform) and "Premium"
  // contained a card called "Tec" for the platform itself. The chips are now the
  // registry's own groups, so a filter cannot describe an app the Hub disagrees
  // with. Each chip carries its count, hence the anchored name matches.
  const chip = chipIn;

  it('renders one chip per shared category, plus All', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    expect(chip('All')).toBeInTheDocument();
    for (const g of GROUPS) {
      expect(chip(g.label.en)).toBeInTheDocument();
    }
  });

  it('every chip shows the real number of apps behind it', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    for (const g of GROUPS) {
      expect(chip(g.label.en).textContent).toContain(String(g.count));
    }
  });

  it('filtering by a category shows exactly that category', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    fireEvent.click(chip('Money'));
    for (const app of APPS.filter(a => a.category === 'money')) {
      expect(screen.getAllByText(app.name.en).length, app.slug).toBeGreaterThan(0);
    }
    // Life is Identity & Social, not Money.
    expect(screen.queryByText('Life')).not.toBeInTheDocument();
  });

  it('files DX under Business & Work, and has no Health chip at all', async () => {
    // "Health" was a hand-typed category that matched one app: the developer platform.
    const HomePage = await getPage();
    render(<HomePage />);
    expect(screen.queryByRole('button', { name: /^Health/ })).not.toBeInTheDocument();
    fireEvent.click(chip('Business'));
    expect(screen.getByText('DX')).toBeInTheDocument();
  });

  it('files Zone under Trust — the same category the Hub grid puts it in', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    fireEvent.click(chip('Trust'));
    expect(screen.getByText('Zone')).toBeInTheDocument();
  });

  it('All returns every app', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    fireEvent.click(chip('Money'));
    fireEvent.click(chip('All'));
    expect(screen.getByText('Life')).toBeInTheDocument();
    expect(screen.getAllByText('Commerce').length).toBeGreaterThan(0);
  });

  it('app count label follows the filter', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const money = GROUPS.find(g => g.key === 'money')!;
    fireEvent.click(chip('Money'));
    expect(screen.getByText(new RegExp(`${money.count} Apps`))).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────────
describe('HomePage — search', () => {
  it('renders search input with placeholder', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    expect(screen.getByLabelText('Search apps')).toBeInTheDocument();
  });

  it('search by app name filters results', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const input = screen.getByLabelText('Search apps');
    fireEvent.change(input, { target: { value: 'Commerce' } });
    expect(screen.getAllByText('Commerce').length).toBeGreaterThan(0);
    // Life should be gone
    expect(screen.queryByText('Life')).not.toBeInTheDocument();
  });

  it('search is case-insensitive', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const input = screen.getByLabelText('Search apps');
    fireEvent.change(input, { target: { value: 'commerce' } });
    expect(screen.getAllByText('Commerce').length).toBeGreaterThan(0);
  });

  it('shows clear button when search has value', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const input = screen.getByLabelText('Search apps');
    fireEvent.change(input, { target: { value: 'Life' } });
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('clear button removes search query', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const input = screen.getByLabelText('Search apps');
    fireEvent.change(input, { target: { value: 'Life' } });
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(input).toHaveValue('');
  });

  it('no clear button when search is empty', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
  });

  it('shows no-results state when nothing matches', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const input = screen.getByLabelText('Search apps');
    fireEvent.change(input, { target: { value: 'ZZZZNOTEXIST' } });
    expect(screen.getByText('No apps found')).toBeInTheDocument();
  });

  it('no-results clear button resets search and category', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const input = screen.getByLabelText('Search apps');
    fireEvent.change(input, { target: { value: 'ZZZZNOTEXIST' } });
    // Both the no-results button and input clear button have name "Clear search";
    // use getAllByRole and click the first one (no-results clear button)
    const clearBtns = screen.getAllByRole('button', { name: 'Clear search' });
    fireEvent.click(clearBtns[0]);
    // Grid should show apps again
    expect(screen.getAllByText('Commerce').length).toBeGreaterThan(0);
  });

  it('search by host shows matching app', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const input = screen.getByLabelText('Search apps');
    fireEvent.change(input, { target: { value: 'fundx.tecosystem.app' } });
    expect(screen.getByText('FundX')).toBeInTheDocument();
  });

  it('search matches the value-prop copy, not just names', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const input = screen.getByLabelText('Search apps');
    fireEvent.change(input, { target: { value: 'wallet' } });
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    expect(screen.queryByText('No apps found')).not.toBeInTheDocument();
  });

  it('search combined with category filter', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    fireEvent.click(chipIn('Money'));
    const input = screen.getByLabelText('Search apps');
    fireEvent.change(input, { target: { value: 'Commerce' } });
    expect(screen.getAllByText('Commerce').length).toBeGreaterThan(0);
    expect(screen.queryByText('Analytics')).not.toBeInTheDocument();
  });

  it('RTL mode shows Arabic placeholder', async () => {
    mockUseTranslation.mockReturnValue(makeMockTRtl());
    const HomePage = await getPage();
    render(<HomePage />);
    expect(screen.getByPlaceholderText('ابحث عن تطبيق...')).toBeInTheDocument();
  });

  it('RTL mode shows Arabic no-results text', async () => {
    mockUseTranslation.mockReturnValue(makeMockTRtl());
    const HomePage = await getPage();
    render(<HomePage />);
    const input = screen.getByPlaceholderText('ابحث عن تطبيق...');
    fireEvent.change(input, { target: { value: 'ZZZZNOTEXIST' } });
    expect(screen.getByText('لا توجد نتائج')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// App cards — openApp + handleKey
// ─────────────────────────────────────────────────────────────────
describe('HomePage — app card interaction', () => {
  it('clicking an app card routes to Sign in (pre-login)', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const lifeCard = screen.getByText('Life').closest('[role="button"]') as HTMLElement;
    expect(lifeCard).toBeTruthy();
    fireEvent.click(lifeCard);
    expect(window.location.hash).toBe('payment');
    expect(window.open).not.toHaveBeenCalled();
  });

  it('clicking a LIVE app card (Assets) also routes to Sign in', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const assetsCard = screen.getByText('Assets').closest('[role="button"]') as HTMLElement;
    expect(assetsCard).toBeTruthy();
    fireEvent.click(assetsCard);
    expect(window.location.hash).toBe('payment');
    expect(window.open).not.toHaveBeenCalled();
  });

  it('clicking a LIVE Commerce card also routes to Sign in', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const commerceCard = screen.getByRole('button', { name: 'Commerce' });
    expect(commerceCard).toBeTruthy();
    fireEvent.click(commerceCard);
    expect(window.location.hash).toBe('payment');
  });

  it('Enter key on an app card routes to Sign in', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const fundxCard = screen.getByText('FundX').closest('[role="button"]') as HTMLElement;
    expect(fundxCard).toBeTruthy();
    fireEvent.keyDown(fundxCard, { key: 'Enter' });
    expect(window.location.hash).toBe('payment');
  });

  it('Space key on an app card routes to Sign in', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const epicCard = screen.getByText('Epic').closest('[role="button"]') as HTMLElement;
    expect(epicCard).toBeTruthy();
    fireEvent.keyDown(epicCard, { key: ' ' });
    expect(window.location.hash).toBe('payment');
  });

  it('other keys on app card do NOT navigate', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const fundxCard = screen.getByText('FundX').closest('[role="button"]') as HTMLElement;
    fireEvent.keyDown(fundxCard, { key: 'Tab' });
    expect(window.location.hash).not.toBe('payment');
    expect(window.open).not.toHaveBeenCalled();
  });

  it('app card is keyboard focusable (tabIndex=0)', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const lifeCard = screen.getByText('Life').closest('[role="button"]') as HTMLElement;
    expect(lifeCard).toHaveAttribute('tabindex', '0');
  });

  it('claims no .pi address — those are the FUTURE homes, and none resolve today', async () => {
    // Every card used to print `<app>.pi` as if it were the live address. It is
    // where each app is going, not where it is; a visitor who typed one got
    // nothing. The registry keeps piDomain for later; the visitor sees the host
    // that actually serves the app.
    const HomePage = await getPage();
    const { container } = render(<HomePage />);
    expect(container.textContent).not.toMatch(/\b[a-z]+\.pi\b/);
  });

  it('live app cards show LIVE badge', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const liveBadges = screen.getAllByText('LIVE');
    // Assets + Commerce are LIVE
    expect(liveBadges.length).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────
// RTL direction
// ─────────────────────────────────────────────────────────────────
describe('HomePage — RTL direction', () => {
  it('renders main with dir=rtl', async () => {
    mockUseTranslation.mockReturnValue(makeMockTRtl());
    const HomePage = await getPage();
    const { container } = render(<HomePage />);
    const main = container.querySelector('main');
    expect(main).toHaveAttribute('dir', 'rtl');
  });

  it('RTL: app arrows show ←', async () => {
    mockUseTranslation.mockReturnValue(makeMockTRtl());
    const HomePage = await getPage();
    render(<HomePage />);
    const arrows = screen.getAllByText('←');
    expect(arrows.length).toBeGreaterThan(0);
  });

  it('LTR: app arrows show →', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const arrows = screen.getAllByText('→');
    expect(arrows.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// App count label
// ─────────────────────────────────────────────────────────────────
describe('HomePage — app count', () => {
  it('shows the registry total when unfiltered', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    expect(screen.getByText(`${APPS.length} Apps`)).toBeInTheDocument();
  });

  it('shows 0 count when no results', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const input = screen.getByLabelText('Search apps');
    fireEvent.change(input, { target: { value: 'ZZZZNOTEXIST' } });
    expect(screen.getByText('0 Apps')).toBeInTheDocument();
  });
});
