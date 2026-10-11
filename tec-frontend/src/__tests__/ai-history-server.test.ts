/**
 * TEC AI conversations follow the ACCOUNT — the server copy (C-104 §5.4 · tec-core-backend #411).
 *
 * The device copy (lib/ai-session.ts) mirrors every change to /api/bff/ai/history
 * through a sink; when the assistant opens, `hydrate` brings the server's copy onto
 * the device — or uploads the device's conversations once, when the server has none.
 * Only settled user/assistant text travels, in order, and a guest never sends anything.
 * The BFF forwards the session's token and names no user; the service reads none.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import {
  saveConversation, archiveConversation, listArchives, restoreArchive, clearAll, loadConversation, setConversationSink,
} from '@/lib/ai-session';
import { hydrate, serverSink, settled, toServerTurns, SAVE_DEBOUNCE_MS } from '@/lib-client/ai/history-sync';

const KEY = 'tec_ai_drawer';
const UUID = '11111111-2222-4333-8444-555555555555';
const signIn = (on: boolean) => {
  document.cookie = 'tec_user=; max-age=0; path=/';
  if (on) document.cookie = `tec_user=${encodeURIComponent(JSON.stringify({ id: 'u1' }))}; path=/`;
};
const posts = (f: ReturnType<typeof vi.fn>) =>
  f.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)) as Record<string, unknown>);
const ok = (body: unknown = { success: true }) => new Response(JSON.stringify(body), { status: 200 });

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); signIn(true); setConversationSink(serverSink); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); setConversationSink(null); });

describe('what travels', () => {
  it('settled user and assistant text only — the UI\'s "ai" becomes "assistant"; a streaming reply stays home', () => {
    expect(toServerTurns([
      { role: 'user', text: 'hi' },
      { role: 'ai', text: 'hello', thumbs: ['x'] } as never,
      { role: 'ai', text: 'half a sen', streaming: true } as never,
      { role: 'user', text: '   ' },
    ])).toEqual([{ role: 'user', text: 'hi' }, { role: 'assistant', text: 'hello' }]);
  });

  it('at most 40 turns, the most recent', () => {
    const many = Array.from({ length: 45 }, (_, i) => ({ role: 'user', text: `q${i}` }));
    const out = toServerTurns(many);
    expect(out).toHaveLength(40);
    expect(out[0].text).toBe('q5');
  });
});

describe('the sink', () => {
  it('a burst of saves (a streamed answer) becomes ONE request after the debounce', async () => {
    vi.useFakeTimers();
    const f = vi.fn(async () => ok()); vi.stubGlobal('fetch', f);
    saveConversation(KEY, [{ role: 'user', text: 'hi' }]);
    saveConversation(KEY, [{ role: 'user', text: 'hi' }, { role: 'ai', text: 'hel' }]);
    saveConversation(KEY, [{ role: 'user', text: 'hi' }, { role: 'ai', text: 'hello' }]);
    expect(f).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS + 10);
    await settled();
    expect(posts(f)).toEqual([{ action: 'save', surface: KEY, turns: [{ role: 'user', text: 'hi' }, { role: 'assistant', text: 'hello' }] }]);
  });

  it('"New chat" sends the pending save FIRST, then the archive — never the other way round', async () => {
    const f = vi.fn(async (url: string) => (String(url).includes('?surface=') ? ok({ available: true, live: null, archives: [] }) : ok()));
    vi.stubGlobal('fetch', f);
    saveConversation(KEY, [{ role: 'user', text: 'hi' }]);
    archiveConversation(KEY);
    await settled();
    expect(posts(f).map(p => p.action)).toEqual(['save', 'archive']);
  });

  it('restoring a server row sends restore; a device-only id sends nothing', async () => {
    const f = vi.fn(async (url: string) => (String(url).includes('?surface=') ? ok({ available: true, live: null, archives: [] }) : ok()));
    vi.stubGlobal('fetch', f);
    localStorage.setItem(`${KEY}:archive@u1`, JSON.stringify([
      { id: UUID, title: 'a', at: 1, turns: [{ role: 'user', text: 'a' }] },
      { id: 'local-123', title: 'b', at: 2, turns: [{ role: 'user', text: 'b' }] },
    ]));
    restoreArchive(KEY, UUID);
    restoreArchive(KEY, 'local-123');
    await settled();
    expect(posts(f).filter(p => p.action === 'restore')).toEqual([{ action: 'restore', surface: KEY, id: UUID }]);
    // One operation on the server — restore's internal archive/save are not sent separately.
    expect(posts(f).filter(p => p.action === 'archive')).toEqual([]);
  });

  it('"Clear all" clears the server copy too', async () => {
    const f = vi.fn(async () => ok()); vi.stubGlobal('fetch', f);
    saveConversation(KEY, [{ role: 'user', text: 'hi' }]);
    clearAll(KEY);
    await settled();
    expect(posts(f)).toEqual([{ action: 'clear', surface: KEY }]);
  });

  it('a guest sends nothing', async () => {
    signIn(false);
    vi.useFakeTimers();
    const f = vi.fn(async () => ok()); vi.stubGlobal('fetch', f);
    saveConversation(KEY, [{ role: 'user', text: 'hi' }]);
    archiveConversation(KEY);
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS + 10);
    expect(f).not.toHaveBeenCalled();
  });
});

describe('hydrate — when the assistant opens', () => {
  it('the server\'s copy replaces the device copy — this is how a conversation follows the account', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({ available: true,
      live: [{ role: 'user', text: 'from my other phone' }, { role: 'assistant', text: 'yes' }],
      archives: [{ id: UUID, title: 'older', at: 5, turns: [{ role: 'user', text: 'older' }] }],
    })));
    saveConversation(KEY, [{ role: 'user', text: 'stale device copy' }]);
    setConversationSink(null);
    const live = await hydrate(KEY);
    expect(live).toEqual([{ role: 'user', text: 'from my other phone' }, { role: 'ai', text: 'yes' }]);
    expect(loadConversation(KEY)).toEqual(live);
    expect(listArchives(KEY).map(a => a.id)).toEqual([UUID]);
  });

  it('nothing on the server yet: the device\'s conversations are uploaded once — oldest archive first, then the live thread', async () => {
    const f = vi.fn(async (url: string) => (String(url).includes('?surface=') ? ok({ available: true, live: null, archives: [] }) : ok()));
    vi.stubGlobal('fetch', f);
    setConversationSink(null);
    saveConversation(KEY, [{ role: 'user', text: 'first' }]);  archiveConversation(KEY);
    saveConversation(KEY, [{ role: 'user', text: 'second' }]); archiveConversation(KEY);
    saveConversation(KEY, [{ role: 'user', text: 'now' }]);
    expect(await hydrate(KEY)).toBeNull();
    await settled();
    expect(posts(f)).toEqual([
      { action: 'save', surface: KEY, turns: [{ role: 'user', text: 'first' }] }, { action: 'archive', surface: KEY },
      { action: 'save', surface: KEY, turns: [{ role: 'user', text: 'second' }] }, { action: 'archive', surface: KEY },
      { action: 'save', surface: KEY, turns: [{ role: 'user', text: 'now' }] },
    ]);
  });

  it('server unavailable (not deployed, down): the device copy is left exactly as it is', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({ available: false })));
    setConversationSink(null);
    saveConversation(KEY, [{ role: 'user', text: 'keep me' }]);
    expect(await hydrate(KEY)).toBeNull();
    expect(loadConversation(KEY)).toEqual([{ role: 'user', text: 'keep me' }]);
  });

  it('a guest is never hydrated', async () => {
    signIn(false);
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    expect(await hydrate(KEY)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});

describe('the BFF — the session\'s token, forwarded; no user named', () => {
  const SECRET = 'a-32-character-secret-for-tests!!';
  const token = () => new SignJWT({ pi_username: 'mans809' }).setProtectedHeader({ alg: 'HS256' }).setSubject('u1')
    .setExpirationTime('5m').sign(new TextEncoder().encode(SECRET));
  const req = async (method: string, body?: unknown, qs = '') => new NextRequest(`https://hub.tecosystem.app/api/bff/ai/history${qs}`, {
    method, headers: { authorization: `Bearer ${await token()}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  beforeEach(() => { process.env.JWT_SECRET = SECRET; process.env.API_GATEWAY_URL = 'https://gw'; });

  it('each action goes to its identity path with the bearer token — and a user_id in the body is not forwarded', async () => {
    const f = vi.fn(async () => ok({ success: true, data: {} })); vi.stubGlobal('fetch', f);
    const { POST } = await import('@/app/api/bff/ai/history/route');
    await POST(await req('POST', { action: 'save', surface: KEY, turns: [{ role: 'user', text: 'hi' }], user_id: 'someone' }));
    await POST(await req('POST', { action: 'restore', surface: KEY, id: UUID }));
    await POST(await req('POST', { action: 'delete', id: UUID }));
    await POST(await req('POST', { action: 'clear' }));
    const calls = f.mock.calls.map(([u, i]) => `${(i as RequestInit).method} ${String(u).replace('https://gw/api/identity/ai/conversations', '')}`);
    expect(calls).toEqual(['PUT /live', `POST /${UUID}/restore`, `DELETE /${UUID}`, 'DELETE ']);
    const saveBody = JSON.parse(String((f.mock.calls[0][1] as RequestInit).body));
    expect(saveBody).toEqual({ surface: KEY, turns: [{ role: 'user', text: 'hi' }] });
    expect(((f.mock.calls[0][1] as RequestInit).headers as Record<string, string>).Authorization).toMatch(/^Bearer /);
  });

  it('an unknown action, a bad surface or a non-uuid id is a 400 and nothing is forwarded', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    const { POST } = await import('@/app/api/bff/ai/history/route');
    for (const b of [{ action: 'wipe' }, { action: 'archive', surface: 'other' }, { action: 'delete', id: 'local-1' }]) {
      expect((await POST(await req('POST', b))).status).toBe(400);
    }
    expect(f).not.toHaveBeenCalled();
  });

  it('GET says available:false when the service is not there yet — never an error the drawer has to handle', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    const { GET } = await import('@/app/api/bff/ai/history/route');
    const res = await GET(await req('GET', undefined, `?surface=${KEY}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ available: false });
  });
});
