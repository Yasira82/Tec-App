/**
 * The Hub home in Arabic — the screens a signed-in user actually lands on.
 *
 * The first Arabization pass translated the Hub's pages and missed the three
 * components that make up its home screen. The result looked broken rather than
 * untranslated: an English sentence inside an RTL block has its full stop moved
 * to the front by the bidi algorithm, so the balance disclosure rendered as
 * ".Not your Pi Network wallet" — which is what "المحفظة قطعت" was describing.
 *
 * These assertions cover the three, in the language the user picked.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils/render-with-locale';
import { HubWalletCard } from '@/components/hub/HubWalletCard';
import { HubCarousel }   from '@/components/hub/HubCarousel';
import { HubHeader }     from '@/components/hub/HubHeader';
import { ar } from '@/lib/i18n/ar';
import { en } from '@/lib/i18n/en';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/lib/hub/utils', () => ({ haptic: vi.fn() }));

const wallet = (locale: 'en' | 'ar') =>
  render(<HubWalletCard balance="2186.00" piPrice={null} />, { locale });

describe('wallet card', () => {
  it('translates the balance label, the actions and the disclosures', () => {
    wallet('ar');
    expect(screen.getByText(ar.hub.wallet.internalBalance)).toBeTruthy();
    expect(screen.getByText(ar.hub.wallet.notPiWallet)).toBeTruthy();
    expect(screen.getByText(ar.hub.wallet.internalOnly)).toBeTruthy();
    for (const label of [ar.hub.wallet.send, ar.hub.wallet.receive, ar.hub.wallet.history]) {
      expect(screen.getByText(label), label).toBeTruthy();
    }
  });

  it('leaves no English disclosure behind on the Arabic card', () => {
    // The disclosure is the sentence that broke: a period at the end of an English
    // sentence jumps to the head of the line inside an RTL block.
    wallet('ar');
    expect(screen.queryByText(en.hub.wallet.notPiWallet)).toBeNull();
    expect(screen.queryByText(en.hub.wallet.internalOnly)).toBeNull();
    expect(screen.queryByText('TEC INTERNAL BALANCE')).toBeNull();
  });

  it('still reads correctly in English', () => {
    wallet('en');
    expect(screen.getByText(en.hub.wallet.internalBalance)).toBeTruthy();
    expect(screen.getByText(en.hub.wallet.notPiWallet)).toBeTruthy();
  });

  it('aligns to the reading direction, not to the left edge', () => {
    const { container } = wallet('ar');
    const card = container.querySelector('button');
    expect(card?.style.textAlign).toBe('start');
  });
});

describe('carousel', () => {
  const carousel = (locale: 'en' | 'ar', idx = 1) =>
    render(
      <HubCarousel
        carouselIdx={idx}
        setCarouselIdx={vi.fn()}
        piPrice={null}
        goToPioneers={vi.fn()}
        goToReferral={vi.fn()}
      />,
      { locale },
    );

  // An RTL flex row starts at the right, so a fixed `translateX(-N%)` pushes the
  // track AWAY from the viewport instead of across it — the Hub's top slot was
  // simply blank in Arabic. The slides were there; they were nowhere visible.
  it('slides toward the reader in English', () => {
    const { container } = carousel('en');
    const track = container.querySelector('div[style*="translateX"]') as HTMLElement;
    expect(track.style.transform).toBe('translateX(-100%)');
  });

  it('slides the other way in Arabic', () => {
    const { container } = carousel('ar');
    const track = container.querySelector('div[style*="translateX"]') as HTMLElement;
    expect(track.style.transform).toBe('translateX(100%)');
  });

  it('shows the Arabic slide copy', () => {
    carousel('ar', 0);
    expect(screen.getByText(ar.hub.carousel.foundingTitle)).toBeTruthy();
  });
});

describe('header', () => {
  const header = (locale: 'en' | 'ar') =>
    render(<HubHeader piUsername="yas55eR82" time="12:18 PM" notifCount={0} onNotifClick={vi.fn()} />, { locale });

  it('uses the compact language switcher — the full word overflowed the row', () => {
    // At 390px the word "English" was what pushed the account chip off the screen
    // edge and gave the page a horizontal scrollbar.
    header('ar');
    expect(screen.getByText('EN')).toBeTruthy();
    expect(screen.queryByText('English')).toBeNull();
  });

  it('names the destination on the switcher, not the current language', () => {
    header('en');
    expect(screen.getByLabelText('التبديل إلى العربية')).toBeTruthy();
  });

  it('clips rather than overflows', () => {
    const { container } = header('ar');
    expect((container.querySelector('header') as HTMLElement).style.overflow).toBe('hidden');
  });
});
