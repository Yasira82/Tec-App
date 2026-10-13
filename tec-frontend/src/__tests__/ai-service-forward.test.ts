/**
 * The Hub forwards TEC AI's chat to tec-ai-service (tec-core-backend #419) and answers with its
 * own copy only when the service did not (owner, 2026-10-13: "the Hub falls back to its own code").
 *
 * The rule under test: a reply is the service's ONLY when it carries `x-tec-ai: service`.
 * Everything else — unreachable, a gateway 502/404, NOT_CONFIGURED — falls back, and the person
 * gets the same answer the Hub always gave.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('jose', () => ({
  jwtVerify: vi.fn(async () => ({ payload: { sub: 'u1' } })),
  SignJWT: vi.fn(),
}));

const BODY = { messages: [{ role: 'user', content: 'hi' }] };

function req(auth: string | null = 'Bearer t'): NextRequest {
  return {
    headers: { get: (h: string) => (h.toLowerCase() === 'authorization' ? auth : null) },
    cookies: { get: () => undefined },
    text:    async () => JSON.stringify(BODY),
    json:    async () => BODY,
  } as unknown as NextRequest;
}

const sse = (text: string, headers: Record<string, string>) =>
  new Response(`data: ${JSON.stringify({ text })}\n\n`, { status: 200, headers: { 'content-type': 'text/event-stream', ...headers } });
/** What Gemini itself streams — the Hub's own copy turns it into the same `{ text }` events. */
const gemini = (text: string) =>
  new Response(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`, { status: 200 });

async function load() {
  vi.resetModules();
  return import('@/app/api/ai/chat/route');
}

beforeEach(() => {
  process.env.API_GATEWAY_URL = 'https://gw.test';
  process.env.INTERNAL_SECRET = 'k'.repeat(40);
  process.env.JWT_SECRET      = 's'.repeat(40);
  process.env.GEMINI_API_KEY  = 'g'.repeat(20);
  delete process.env.AI_SERVICE_CHAT;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GEMINI_API_KEY;
});

describe('the chat goes to tec-ai-service first', () => {
  it('a marked reply is passed through as it streams — the local providers are never called', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/api/identity/ai/chat')
        ? sse('from the service', { 'x-tec-ai': 'service', 'x-ai-provider': 'gemini' })
        : sse('from the hub', {}));
    vi.stubGlobal('fetch', fetchMock);

    const res = await (await load()).POST(req());
    expect(await res.text()).toContain('from the service');
    expect(res.headers.get('x-tec-ai')).toBe('service');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://gw.test/api/identity/ai/chat');
    const h = init.headers as Record<string, string>;
    expect(h.authorization).toBe('Bearer t');
    expect(h['x-internal-key']).toBe('k'.repeat(40));
    expect(JSON.parse(init.body as string)).toEqual(BODY);
  });

  it('a service error that IS the service\'s answer (marked) is passed through, not retried locally', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ code: 'BUSY' }), { status: 503, headers: { 'x-tec-ai': 'service', 'retry-after': '5' } }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await (await load()).POST(req());
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('5');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['unreachable',            () => Promise.reject(new Error('ECONNREFUSED'))],
    ['a gateway 502',          () => Promise.resolve(new Response('bad gateway', { status: 502 }))],
    ['NOT_CONFIGURED (no key)', () => Promise.resolve(new Response('{"code":"NOT_CONFIGURED"}', { status: 503 }))],
  ])('%s → the Hub answers with its own copy', async (_label, serviceReply) => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/api/identity/ai/chat')
        ? serviceReply()
        : gemini('from the hub'));
    vi.stubGlobal('fetch', fetchMock);

    const res = await (await load()).POST(req());
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('from the hub');
    expect(res.headers.get('x-tec-ai')).toBeNull();
  });

  it('AI_SERVICE_CHAT=off skips the forward entirely', async () => {
    process.env.AI_SERVICE_CHAT = 'off';
    const fetchMock = vi.fn(async () => sse('from the hub', {}));
    vi.stubGlobal('fetch', fetchMock);

    await (await load()).POST(req());
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/identity/ai/chat'))).toBe(false);
  });

  it('no session → no forward; the local gate answers SIGN_IN', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await (await load()).POST(req(null));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
