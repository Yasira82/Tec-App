/**
 * The assistant's menu — archives, settings, starters, support.
 *
 * The rule this file also guards: the menu contains NOTHING about the Hub. The panel it
 * replaced held "TEC Hub / Pay with Pi / My Dashboard / Digital Assets", which made the
 * assistant a second front door to the platform, bypassing sign-in-with-Pi as the single
 * entry point.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AIMenu } from '@/components/ai/AIMenu';
import {
  saveConversation, archiveConversation, listArchives, loadConversation,
  loadSettings, restoreArchive, deleteArchive, hasArchive,
} from '@/lib/ai-session';

const KEY = 'test_ai';
const noop = () => {};

function menu(props: Partial<React.ComponentProps<typeof AIMenu>> = {}) {
  return render(
    <AIMenu storeKey={KEY} locale="en" onRestore={noop} onAsk={noop}
      onClearAll={noop} onClose={noop} {...props} />,
  );
}

beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });

describe('archive list', () => {
  it('keeps several past conversations, newest first', () => {
    saveConversation(KEY, [{ role: 'user', text: 'first question' }]);
    archiveConversation(KEY);
    saveConversation(KEY, [{ role: 'user', text: 'second question' }]);
    archiveConversation(KEY);

    const list = listArchives(KEY);
    expect(list).toHaveLength(2);
    expect(list[0].title).toBe('second question');
  });

  it('titles an entry with the first thing the user asked', () => {
    saveConversation(KEY, [
      { role: 'user', text: 'how do I pay with Pi?' },
      { role: 'ai',   text: 'long answer' },
    ]);
    archiveConversation(KEY);
    expect(listArchives(KEY)[0].title).toBe('how do I pay with Pi?');
  });

  it('archiving an EMPTY thread does not add a blank entry', () => {
    archiveConversation(KEY);
    expect(listArchives(KEY)).toHaveLength(0);
  });

  it('restoring archives the live thread first — nothing in progress is lost', () => {
    saveConversation(KEY, [{ role: 'user', text: 'old one' }]);
    archiveConversation(KEY);
    const id = listArchives(KEY)[0].id;

    saveConversation(KEY, [{ role: 'user', text: 'in progress' }]);
    const turns = restoreArchive(KEY, id);

    expect(turns[0].text).toBe('old one');
    expect(loadConversation(KEY)[0].text).toBe('old one');
    // The in-progress thread went to the archive rather than being dropped.
    expect(listArchives(KEY).some(a => a.title === 'in progress')).toBe(true);
  });

  it('deletes one entry without touching the others', () => {
    saveConversation(KEY, [{ role: 'user', text: 'a' }]); archiveConversation(KEY);
    saveConversation(KEY, [{ role: 'user', text: 'b' }]); archiveConversation(KEY);
    deleteArchive(KEY, listArchives(KEY)[0].id);
    expect(listArchives(KEY)).toHaveLength(1);
  });

  it('renders the saved conversations and restores on click', () => {
    saveConversation(KEY, [{ role: 'user', text: 'my old chat' }]);
    archiveConversation(KEY);
    const onRestore = vi.fn();
    menu({ onRestore });

    fireEvent.click(screen.getByText('my old chat'));
    expect(onRestore).toHaveBeenCalled();
    expect(onRestore.mock.calls[0][0][0].text).toBe('my old chat');
  });

  it('says so when there is nothing saved', () => {
    menu();
    expect(screen.getByText(/No saved conversations/)).toBeTruthy();
  });
});

describe('settings', () => {
  it('persists the reply language and reports it to the surface', () => {
    const onSettingsChange = vi.fn();
    menu({ onSettingsChange });
    fireEvent.click(screen.getByText('Settings'));
    fireEvent.click(screen.getByText('Arabic'));

    expect(loadSettings().replyLocale).toBe('ar');
    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ replyLocale: 'ar' }));
  });

  it('persists the reply length', () => {
    menu();
    fireEvent.click(screen.getByText('Settings'));
    fireEvent.click(screen.getByText('Short'));
    expect(loadSettings().replyLength).toBe('short');
  });

  it('falls back to defaults when the stored value is nonsense', () => {
    localStorage.setItem('tec_ai_settings', '{"replyLocale":"klingon","replyLength":42}');
    expect(loadSettings()).toEqual({ replyLocale: 'auto', replyLength: 'detailed' });
  });

  it('asks before wiping everything — one tap arms, the second destroys', () => {
    saveConversation(KEY, [{ role: 'user', text: 'x' }]);
    archiveConversation(KEY);
    const onClearAll = vi.fn();
    menu({ onClearAll });

    fireEvent.click(screen.getByText('Settings'));
    fireEvent.click(screen.getByText('Clear all conversations'));
    // Armed, not fired.
    expect(hasArchive(KEY)).toBe(true);
    expect(onClearAll).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText(/Sure\?/));
    expect(hasArchive(KEY)).toBe(false);
    expect(onClearAll).toHaveBeenCalled();
  });
});

describe('starters and support', () => {
  it('a starter question fills the composer instead of navigating', () => {
    const onAsk = vi.fn();
    const { container } = menu({ onAsk });
    fireEvent.click(screen.getByText('Starter questions'));
    fireEvent.click(screen.getByText('How do I pay with Pi?'));

    expect(onAsk).toHaveBeenCalledWith('How do I pay with Pi?');
    // It is a question, not a link.
    expect(container.querySelector('a')).toBeNull();
  });

  it('offers real support channels, the same ones on every surface', () => {
    menu();
    fireEvent.click(screen.getByText('Support'));
    // These lived in a private right-hand panel on /ai only; the Hub drawer had none.
    for (const channel of ['WhatsApp', 'Telegram', 'Email', 'Call']) {
      expect(screen.getByText(channel)).toBeTruthy();
    }
  });

  it('carries the CURRENT contact values, not the ones they replaced', () => {
    // These changed once and would change again silently: a stale WhatsApp
    // number or a retired Telegram handle still renders as a working link, and
    // the first signal is a user saying nobody answered.
    const { container } = menu();
    fireEvent.click(screen.getByText('Support'));
    const hrefs = Array.from(container.querySelectorAll('a')).map(a => a.getAttribute('href'));

    expect(hrefs).toContain('https://wa.me/201109742713');
    expect(hrefs).toContain('https://t.me/+7yEiJGgSZ2QzM2M0');
    // The personal handle it replaced pointed at one account rather than the
    // platform, and a @handle cannot be revoked the way an invite can.
    expect(hrefs).not.toContain('https://t.me/Yasira17');
    expect(hrefs).not.toContain('https://wa.me/201115141346');
  });

  it('separates "reach us now" from "who are you"', () => {
    // Social under its own heading. Mixed into Contact us, a Facebook page sits
    // beside a phone number and someone in trouble reads five options to find
    // the two that answer.
    const { container } = menu();
    fireEvent.click(screen.getByText('Support'));
    expect(screen.getByText('TEC on social')).toBeTruthy();
    const hrefs = Array.from(container.querySelectorAll('a')).map(a => a.getAttribute('href') ?? '');
    expect(hrefs.some(h => h.includes('facebook.com'))).toBe(true);
    expect(hrefs.some(h => h.includes('x.com'))).toBe(true);
  });

  it('records a rating without asking twice', () => {
    menu();
    fireEvent.click(screen.getByText('Support'));
    fireEvent.click(screen.getAllByText('★')[3]);
    expect(screen.getByText(/Thanks for your rating/)).toBeTruthy();
    expect(screen.queryByText('★')).toBeNull();
  });
});

describe('the menu is the assistant’s, not the Hub’s', () => {
  it('links only OUT to support — never in to an app page', () => {
    saveConversation(KEY, [{ role: 'user', text: 'x' }]);
    archiveConversation(KEY);
    const { container } = menu();

    for (const tab of ['Chats', 'Starter questions', 'Settings', 'Support']) {
      fireEvent.click(screen.getByText(tab));
      for (const a of Array.from(container.querySelectorAll('a'))) {
        const href = a.getAttribute('href') ?? '';
        // A relative href is an in-platform destination — that is the thing this
        // menu must never grow back.
        //
        // This used to enumerate the allowed HOSTS (wa.me|t.me). That made adding
        // a legitimate channel — Facebook, X — look like a test failure, and the
        // quickest way past a red test is to loosen it. Pinning the RULE instead
        // of the roster means the guard survives the next channel without anyone
        // having to weaken it.
        expect(href).toMatch(/^(https:\/\/|mailto:|tel:)/);
        expect(href).not.toMatch(/^https:\/\/[^/]*tecosystem\.app/);
      }
    }
  });

  it('does not name Hub destinations anywhere in its copy', () => {
    const { container } = menu();
    for (const banned of ['My Dashboard', 'Digital Assets', 'Pay with Pi']) {
      expect(container.textContent).not.toContain(banned);
    }
  });
});
