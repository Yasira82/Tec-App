/**
 * Arabic is not just translated strings — it is a direction.
 *
 * Every Hub sub-page renders through `HubSubShell`, so `dir` is set there once
 * rather than on each page (one place to be right, and no page can forget it).
 * These assertions hold that: the shell flips to RTL, the back arrow points the
 * way "back" actually is, and the page underneath renders Arabic copy — not an
 * English fallback that only *looks* translated because the header changed.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils/render-with-locale';
import { HubSubShell } from '@/components/hub';
import { ar } from '@/lib/i18n/ar';
import { en } from '@/lib/i18n/en';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));

const shell = () => document.querySelector('div[dir]') as HTMLElement | null;

describe('document direction', () => {
  it('flips <html lang/dir> with the reader’s choice', () => {
    // The root layout ships static `lang="en" dir="ltr"`. If only the app shell
    // flipped, the scrollbar and anything portalled outside it would stay LTR.
    render(<HubSubShell title="x"><p>y</p></HubSubShell>, { locale: 'ar' });
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');

    render(<HubSubShell title="x"><p>y</p></HubSubShell>, { locale: 'en' });
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
  });
});

describe('HubSubShell direction', () => {
  it('renders left-to-right in English', () => {
    render(<HubSubShell title={en.hub.notifications.title}><p>x</p></HubSubShell>, { locale: 'en' });
    expect(shell()?.getAttribute('dir')).toBe('ltr');
    expect(screen.getByText('←')).toBeTruthy();
  });

  it('renders right-to-left in Arabic, with the back arrow flipped', () => {
    render(<HubSubShell title={ar.hub.notifications.title}><p>x</p></HubSubShell>, { locale: 'ar' });
    expect(shell()?.getAttribute('dir')).toBe('rtl');
    expect(screen.getByText('→')).toBeTruthy();
    // A "←" in an RTL layout points forward, not back — the one arrow a user
    // reads as "leave this page".
    expect(screen.queryByText('←')).toBeNull();
  });

  it('shows the Arabic title and subtitle the dictionary actually holds', () => {
    render(
      <HubSubShell title={ar.hub.notifications.title} subtitle={ar.hub.notifications.allCaught}>
        <p>x</p>
      </HubSubShell>,
      { locale: 'ar' },
    );
    expect(screen.getByText(ar.hub.notifications.title)).toBeTruthy();
    expect(screen.getByText(ar.hub.notifications.allCaught)).toBeTruthy();
    // And the English wording is gone — a bilingual screen is a half-translated one.
    expect(screen.queryByText(en.hub.notifications.allCaught)).toBeNull();
  });
});
