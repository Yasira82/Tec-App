/**
 * The Hub grid opens an app STANDALONE, on its own domain (owner decision,
 * 2026-10-02 — KB audits/HUB_GRID_VISITS_NOT_COUNTED_2026-09-29.md).
 *
 * It used to navigate through `/api/auth/sso?target=…` with `window.location`.
 * The app then saw the Hub as referrer, marked the tab Hub-owned (ADR-007),
 * never signed the visitor in with Pi — so Pi credited the HUB for the visit —
 * and bounced every purchase into the Hub's modal, where Pi answered nothing
 * for 90 seconds (C-123 §9).
 *
 * What these pin is what a refactor would quietly undo: a real link, a new tab,
 * NO referrer, the signed href (not one rewritten inside the tap), and the old
 * behaviour kept where it still belongs — editing, and the Dashboard's launcher.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test-utils/render-with-locale';
import { HubAppsGrid } from '@/components/hub/HubAppsGrid';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('@/lib/hub/utils', () => ({ haptic: vi.fn() }));

const SIGNED = 'https://ecommerce.tecosystem.app/api/auth/sso-callback?token=t1&redirect=%2F';
const APPS = [
  { slug: 'ecommerce', name: 'Ecommerce', desc: 'Shop', emoji: '', group: '',
    href: SIGNED, appUrl: 'https://ecommerce.tecosystem.app' },
  { slug: 'assets', name: 'Assets', desc: 'Digital assets', emoji: '', group: '', href: '/assets' },
];

beforeEach(() => { localStorage.clear(); });

const link = (name: string) => screen.getByText(name).closest('a');

describe('Hub grid — an app opens standalone', () => {
  it('is a real link to the signed href, in a new tab, with NO referrer', () => {
    render(<HubAppsGrid apps={APPS} />);
    const a = link('Ecommerce')!;
    expect(a).toBeTruthy();
    expect(a.getAttribute('href')).toBe(SIGNED);
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toContain('noreferrer');
    expect(a.getAttribute('href')).not.toContain('/api/auth/sso?target=');
  });

  it('reports the tap so the spent token is replaced — without touching this href', () => {
    const onOpen = vi.fn();
    render(<HubAppsGrid apps={APPS} onOpenStandalone={onOpen} />);
    const a = link('Ecommerce')!;
    fireEvent.click(a);
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ slug: 'ecommerce' }));
    expect(link('Ecommerce')!.getAttribute('href')).toBe(SIGNED);
  });

  it('keeps a Hub route (no appUrl) as an in-app button', () => {
    render(<HubAppsGrid apps={APPS} />);
    expect(link('Assets')).toBeNull();
  });

  it('in Edit mode a tap pins the app — it never leaves the Hub', () => {
    render(<HubAppsGrid apps={APPS} />);
    fireEvent.click(screen.getByText('Edit'));
    expect(link('Ecommerce')).toBeNull();
  });

  it('the Dashboard launcher (openTo) still sends the tap to the Hub', () => {
    render(<HubAppsGrid apps={APPS} openTo="/hub" />);
    expect(link('Ecommerce')).toBeNull();
  });
});
