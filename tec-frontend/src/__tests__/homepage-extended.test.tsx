/**
 * Extended tests for HomePage (src/app/page.tsx)
 * Targets: category filter, search, openApp, handleKey, Nexus button,
 *          no-results state, clear search, LTR/RTL direction, footer links.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ── Mocks ─────────────────────────────────────────────────────────

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
      install: { cta: 'Add TEC', sub: 'One tap', button: 'Install', stepsTitle: 'Steps', step1: 'One', step2: 'Two', step3: 'Three', dismiss: 'Not now' },
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
vi.mock('@/domains/_registry', () => ({
  LIVE_DOMAINS:     [],
  COMING_SOON:      [],
  getVisibleDomains: vi.fn(() => []),
}));

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
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('47M+')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
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

  it('renders Nexus description from t.apps.Nexus', async () => {
    const HomePage = await getPage();
    const { container } = render(<HomePage />);
    // t.apps.Nexus ('TEC Nexus App') appears both in the featured card and the apps grid
    const matches = container.querySelectorAll('*');
    const hasText = Array.from(matches).some(el =>
      el.textContent === 'TEC Nexus App' && el.children.length === 0,
    );
    expect(hasText).toBe(true);
  });

  it('Explore Nexus button opens nexus.pi', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    fireEvent.click(screen.getByText('Explore Nexus →'));
    expect(window.open).toHaveBeenCalledWith(
      'https://nexus.pi',
      '_blank',
      'noopener,noreferrer',
    );
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
describe('HomePage — category filter', () => {
  it('renders all category buttons', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const categories = ['All', 'Finance', 'Premium', 'Business', 'Tech',
      'Personal', 'Health', 'Entertainment', 'Social', 'Hub'];
    for (const cat of categories) {
      expect(screen.getByRole('button', { name: cat })).toBeInTheDocument();
    }
  });

  it('clicking Finance filter shows only Finance apps', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Finance' }));
    // Insure, Assets, Fundx, Nbf are Finance category
    expect(screen.getByText('Insure')).toBeInTheDocument();
    expect(screen.getByText('Assets')).toBeInTheDocument();
    // Life is Personal — should not appear
    expect(screen.queryByText('Life')).not.toBeInTheDocument();
  });

  it('clicking Premium filter shows only Premium apps', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Premium' }));
    expect(screen.getByText('Legend')).toBeInTheDocument();
    expect(screen.getByText('Tec')).toBeInTheDocument();
    // Commerce is Business — should not appear
    expect(screen.queryByText('Commerce')).not.toBeInTheDocument();
  });

  it('clicking Business filter shows Commerce and Ecommerce', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Business' }));
    expect(screen.getByText('Commerce')).toBeInTheDocument();
    expect(screen.getByText('Ecommerce')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  it('clicking All returns all apps', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Finance' }));
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('Life')).toBeInTheDocument();
    expect(screen.getByText('Commerce')).toBeInTheDocument();
  });

  it('clicking Tech filter shows Tech apps only', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Tech' }));
    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.getByText('Alert')).toBeInTheDocument();
    expect(screen.getByText('Nx')).toBeInTheDocument();
    expect(screen.queryByText('Life')).not.toBeInTheDocument();
  });

  it('clicking Entertainment filter shows Epic', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Entertainment' }));
    expect(screen.getByText('Epic')).toBeInTheDocument();
    expect(screen.queryByText('Commerce')).not.toBeInTheDocument();
  });

  it('clicking Social filter shows Connection', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Social' }));
    expect(screen.getByText('Connection')).toBeInTheDocument();
  });

  it('clicking Health filter shows Dx', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Health' }));
    expect(screen.getByText('Dx')).toBeInTheDocument();
  });

  it('app count label shows filtered count', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    // Finance apps: Insure, Assets, Fundx, Nbf = 4
    fireEvent.click(screen.getByRole('button', { name: 'Finance' }));
    expect(screen.getByText(/4 Apps/)).toBeInTheDocument();
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
    expect(screen.getByText('Commerce')).toBeInTheDocument();
    // Life should be gone
    expect(screen.queryByText('Life')).not.toBeInTheDocument();
  });

  it('search is case-insensitive', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const input = screen.getByLabelText('Search apps');
    fireEvent.change(input, { target: { value: 'commerce' } });
    expect(screen.getByText('Commerce')).toBeInTheDocument();
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
    expect(screen.getByText('Commerce')).toBeInTheDocument();
  });

  it('search by domain shows matching app', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const input = screen.getByLabelText('Search apps');
    fireEvent.change(input, { target: { value: 'fundx.pi' } });
    expect(screen.getByText('Fundx')).toBeInTheDocument();
  });

  it('search by category name shows matching apps', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const input = screen.getByLabelText('Search apps');
    fireEvent.change(input, { target: { value: 'finance' } });
    expect(screen.getByText('Assets')).toBeInTheDocument();
  });

  it('search combined with category filter', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Business' }));
    const input = screen.getByLabelText('Search apps');
    fireEvent.change(input, { target: { value: 'Commerce' } });
    expect(screen.getByText('Commerce')).toBeInTheDocument();
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
  it('clicking a non-live app card calls window.open', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    // Life is not in LIVE_APPS
    const lifeCard = screen.getByText('Life').closest('[role="button"]') as HTMLElement;
    expect(lifeCard).toBeTruthy();
    fireEvent.click(lifeCard);
    expect(window.open).toHaveBeenCalledWith(
      'https://life.pi',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('clicking a LIVE app card (Assets) uses SSO redirect', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const assetsCard = screen.getByText('Assets').closest('[role="button"]') as HTMLElement;
    expect(assetsCard).toBeTruthy();
    fireEvent.click(assetsCard);
    expect(window.location.href).toContain('/api/auth/sso');
    expect(window.location.href).toContain('assets.tecosystem.app');
  });

  it('clicking a LIVE Commerce card uses SSO redirect', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const commerceCard = screen.getByText('Commerce').closest('[role="button"]') as HTMLElement;
    expect(commerceCard).toBeTruthy();
    fireEvent.click(commerceCard);
    expect(window.location.href).toContain('/api/auth/sso');
  });

  it('Enter key on an app card triggers openApp', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const fundxCard = screen.getByText('Fundx').closest('[role="button"]') as HTMLElement;
    expect(fundxCard).toBeTruthy();
    fireEvent.keyDown(fundxCard, { key: 'Enter' });
    expect(window.open).toHaveBeenCalledWith(
      'https://fundx.pi',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('Space key on an app card triggers openApp', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const epicCard = screen.getByText('Epic').closest('[role="button"]') as HTMLElement;
    expect(epicCard).toBeTruthy();
    fireEvent.keyDown(epicCard, { key: ' ' });
    expect(window.open).toHaveBeenCalledWith(
      'https://epic.pi',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('other keys on app card do NOT trigger openApp', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const fundxCard = screen.getByText('Fundx').closest('[role="button"]') as HTMLElement;
    fireEvent.keyDown(fundxCard, { key: 'Tab' });
    expect(window.open).not.toHaveBeenCalled();
  });

  it('app card is keyboard focusable (tabIndex=0)', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const lifeCard = screen.getByText('Life').closest('[role="button"]') as HTMLElement;
    expect(lifeCard).toHaveAttribute('tabindex', '0');
  });

  it('app cards show domain text', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    expect(screen.getByText('life.pi')).toBeInTheDocument();
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
  it('shows total count (24) when All category and no search', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    expect(screen.getByText('24 Apps')).toBeInTheDocument();
  });

  it('shows 0 count when no results', async () => {
    const HomePage = await getPage();
    render(<HomePage />);
    const input = screen.getByLabelText('Search apps');
    fireEvent.change(input, { target: { value: 'ZZZZNOTEXIST' } });
    expect(screen.getByText('0 Apps')).toBeInTheDocument();
  });
});
