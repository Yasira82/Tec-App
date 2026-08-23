/**
 * Smoke test for HomePage component.
 * Verifies it renders key UI elements without crashing.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// ---- mock Next.js navigation ----
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: {
      common: {
        piEcosystem: 'Pi Ecosystem',
        appName: 'TEC App',
        tagline: 'Ecosystem',
        brand:   'TEC Ecosystem',
        acronym: 'Trust · Ecosystem · Connect',
        loading: 'Loading...',
        login: 'Login',
      },
      home: {
        description: 'Description',
        subDescription: 'Sub description',
        ecosystem: 'Ecosystem',
        ecosystemTitle: 'Explore — the Apps',
        moreApps: 'More apps',
        stats: { apps: 'Apps', piUsers: 'Pi Users', identity: 'Identity' },
        trust: { free: 'Free', noPassphrase: 'No passphrase', noPurchase: 'No purchase', readOnly: 'Read only', official: 'Official' },
        install: { cta: 'Add TEC', sub: 'One tap', button: 'Install', openInBrowser: 'Open in browser', stepsTitle: 'Steps', step1: 'One', step2: 'Two', step3: 'Three', dismiss: 'Not now' },
        demo: { cta: 'Explore as guest', badge: 'Guest', title: 'T', subtitle: 'S', identityName: 'Demo', identityHandle: '@d', passport: 'P', appsLabel: 'A', identityLabel: 'I', walletLabel: 'W', sampleTag: 'S', doTitle: 'D', do1Title: '1', do1Desc: '1', do2Title: '2', do2Desc: '2', do3Title: '3', do3Desc: '3', signIn: 'Sign in', back: 'Back' },
      },
      dashboard: {
        piIntegration: { connectBtn: 'Connect with Pi' },
      },
      apps: {
        Nexus: 'Nexus',
        Commerce: 'Commerce',
        Assets: 'Assets',
        Fundx: 'Fundx',
        Estate: 'Estate',
        Analytics: 'Analytics',
      },
    },
    language: 'en',
    setLanguage: vi.fn(),
  }),
}));

vi.mock('@/components/LanguageSwitcher', () => ({
  default: () => null,
}));

// Mock PiPaymentButton so tests don't depend on window.Pi
vi.mock('@/components/payment/PiPaymentButton', () => ({
  default: () => <button>💎 Pay 1 Pi = 0.1 TEC</button>,
}));

import HomePage from '@/app/page';

describe('HomePage', () => {
  it('renders without crashing', () => {
    render(<HomePage />);
  });

  it('shows the app name in the hero heading', () => {
    render(<HomePage />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('TEC App');
  });

  it('shows the single Pay 1 Pi payment button', () => {
    render(<HomePage />);
    expect(screen.getByRole('button', { name: /pay 1 pi/i })).toBeInTheDocument();
  });
});
