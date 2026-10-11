/**
 * TEC AI keeps a signed-in person's conversations on THIS device — past a closed tab.
 *
 * The transcript lived in sessionStorage, which dies with the tab, and Pi Browser
 * closes tabs freely: the owner kept losing every conversation (2026-10-11). Now a
 * signed-in person's live thread and archive go to localStorage under a key scoped
 * to their account; a guest keeps the tab-only behaviour. The person reviews and
 * deletes them from the assistant's menu (restore · delete one · clear all), and
 * signing out wipes every conversation on the device — a borrowed phone does not
 * hand the next person a history.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveConversation, loadConversation, archiveConversation, listArchives,
  clearAll, forgetAllConversations,
} from '@/lib/ai-session';

const KEY = 'tec_ai_drawer';
const signIn = (user: Record<string, unknown> | null, encodeTwice = false) => {
  document.cookie = 'tec_user=; max-age=0; path=/';
  if (!user) return;
  const once = encodeURIComponent(JSON.stringify(user));
  document.cookie = `tec_user=${encodeTwice ? encodeURIComponent(once) : once}; path=/`;
};
const closeTab = () => sessionStorage.clear();
const turns = [{ role: 'user', text: 'my goal?' }, { role: 'assistant', text: 'Save 50π.' }];

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); signIn(null); });

describe('a signed-in person', () => {
  it('finds the conversation again after the tab is closed', () => {
    signIn({ id: 'u1', piUsername: 'mans809' });
    saveConversation(KEY, turns);
    closeTab();
    expect(loadConversation(KEY)).toEqual(turns);
  });

  it('keeps the archive past a closed tab too', () => {
    signIn({ id: 'u1' });
    saveConversation(KEY, turns);
    archiveConversation(KEY);
    closeTab();
    expect(listArchives(KEY).map(a => a.title)).toEqual(['my goal?']);
  });

  it("never sees another account's conversations on the same device", () => {
    signIn({ id: 'u1' });
    saveConversation(KEY, turns);
    archiveConversation(KEY);
    saveConversation(KEY, turns);
    signIn({ id: 'u2' });
    expect(loadConversation(KEY)).toEqual([]);
    expect(listArchives(KEY)).toEqual([]);
  });

  it('is recognised from a tec_user cookie written twice-encoded (the 2026-10-10 bug)', () => {
    signIn({ id: 'u1' }, true);
    saveConversation(KEY, turns);
    closeTab();
    expect(loadConversation(KEY)).toEqual(turns);
  });

  it('keeps a conversation that was only in the tab before this change', () => {
    sessionStorage.setItem(KEY, JSON.stringify(turns));
    signIn({ id: 'u1' });
    expect(loadConversation(KEY)).toEqual(turns);
    closeTab();
    expect(loadConversation(KEY)).toEqual(turns);
  });

  it('"Clear all" removes their live thread and archive from the device', () => {
    signIn({ id: 'u1' });
    saveConversation(KEY, turns); archiveConversation(KEY); saveConversation(KEY, turns);
    clearAll(KEY);
    expect(loadConversation(KEY)).toEqual([]);
    expect(listArchives(KEY)).toEqual([]);
    expect(Object.keys(localStorage).filter(k => k.startsWith(KEY))).toEqual([]);
  });
});

describe('a guest', () => {
  it('keeps the tab-only behaviour — nothing written to localStorage', () => {
    saveConversation(KEY, turns);
    expect(loadConversation(KEY)).toEqual(turns);
    expect(localStorage.length).toBe(0);
    closeTab();
    expect(loadConversation(KEY)).toEqual([]);
  });
});

describe('signing out', () => {
  it('forgetAllConversations wipes every account\'s AI history on the device — and nothing else', () => {
    signIn({ id: 'u1' }); saveConversation('tec_ai_drawer', turns); saveConversation('tec_ai_page', turns); archiveConversation('tec_ai_page');
    signIn({ id: 'u2' }); saveConversation('tec_ai_drawer', turns);
    localStorage.setItem('tec_ai_settings', '{"replyLength":"short"}');
    localStorage.setItem('tec_cart', '[]');
    forgetAllConversations();
    expect(Object.keys(localStorage).sort()).toEqual(['tec_ai_settings', 'tec_cart']);
  });

  it('logout() forgets the conversations before it signs out', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
    signIn({ id: 'u1' }); saveConversation(KEY, turns);
    const { logout } = await import('@/lib-client/pi/pi-auth');
    await logout();
    expect(Object.keys(localStorage).filter(k => k.startsWith('tec_ai_drawer'))).toEqual([]);
    vi.unstubAllGlobals();
  });
});
