/**
 * api/ai/chat — createUnifiedStream transform coverage.
 * Providers are mocked with REAL ReadableStream bodies so the route's
 * pipeThrough(createUnifiedStream(provider)) actually runs.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The route auth-gates on a verified TEC session — mock jose so a Bearer token
// resolves to a user (the auth logic itself is covered separately below).
vi.mock('jose', () => ({
  jwtVerify: vi.fn(async () => ({ payload: { sub: 'test-user' } })),
}));

import { POST } from '@/app/api/ai/chat/route';

const encoder = new TextEncoder();

const sseStream = (chunks: string[]) =>
  new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });

const makeRequest = (body: unknown, opts: { auth?: boolean } = { auth: true }) =>
  new Request('http://localhost/api/ai/chat', {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-forwarded-for': `stream-${Math.random()}`,
      // Authenticated by default (jose is mocked to accept it)
      ...(opts.auth === false ? {} : { Authorization: 'Bearer test-token' }),
    },
    body: JSON.stringify(body),
  }) as any;

const savedEnv = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.JWT_SECRET = 'test-secret-32-chars-long-aaaaaaaa';
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.GEMINI_API_KEY;
});

afterEach(() => {
  process.env = { ...savedEnv };
});

const readAll = async (res: Response) => await res.text();

describe('createUnifiedStream via POST', () => {
  it('transforms claude content_block_delta chunks into unified text events', async () => {
    process.env.ANTHROPIC_API_KEY = 'k';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      body: sseStream([
        'data: {"type":"content_block_delta","delta":{"text":"Hel"}}\n\n',
        'data: {"type":"content_block_delta","delta":{"text":"lo"}}\n\n',
        'data: {"type":"message_stop"}\n\n',
        'data: [DONE]\n\n',
      ]),
    } as unknown as Response);

    const res = await POST(makeRequest({ message: 'hi' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('X-AI-Provider')).toBe('claude');
    const out = await readAll(res);
    expect(out).toContain('data: {"text":"Hel"}');
    expect(out).toContain('data: {"text":"lo"}');
    expect(out).not.toContain('message_stop');
  });

  it('handles SSE data split across chunk boundaries (buffering)', async () => {
    process.env.ANTHROPIC_API_KEY = 'k';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      body: sseStream([
        'data: {"type":"content_block_delta","del',
        'ta":{"text":"Joined"}}\n\ndata: [DONE]\n\n',
      ]),
    } as unknown as Response);

    const res = await POST(makeRequest({ message: 'hi' }));
    const out = await readAll(res);
    expect(out).toContain('data: {"text":"Joined"}');
  });

  it('skips non-data lines and invalid JSON without breaking the stream', async () => {
    process.env.ANTHROPIC_API_KEY = 'k';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      body: sseStream([
        'event: ping\n',
        ': comment line\n',
        'data: {broken json!!\n\n',
        'data: {"type":"content_block_delta","delta":{"text":"OK"}}\n\n',
      ]),
    } as unknown as Response);

    const res = await POST(makeRequest({ message: 'hi' }));
    const out = await readAll(res);
    expect(out).toContain('data: {"text":"OK"}');
    expect(out).not.toContain('broken');
  });

  it('transforms groq delta.content chunks', async () => {
    process.env.GROQ_API_KEY = 'k';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      body: sseStream([
        'data: {"choices":[{"delta":{"content":"Groq says hi"}}]}\n\n',
        'data: {"choices":[{"delta":{}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    } as unknown as Response);

    const res = await POST(makeRequest({ message: 'hi' }));
    expect(res.headers.get('X-AI-Provider')).toBe('groq');
    const out = await readAll(res);
    expect(out).toContain('data: {"text":"Groq says hi"}');
  });

  it('transforms gemini candidates parts chunks', async () => {
    process.env.GEMINI_API_KEY = 'k';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      body: sseStream([
        'data: {"candidates":[{"content":{"parts":[{"text":"Gemini reply"}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{}]}}]}\n\n',
      ]),
    } as unknown as Response);

    const res = await POST(makeRequest({ message: 'hi' }));
    expect(res.headers.get('X-AI-Provider')).toBe('gemini');
    const out = await readAll(res);
    expect(out).toContain('data: {"text":"Gemini reply"}');
  });

  it('emits nothing for provider chunks that contain no text', async () => {
    process.env.ANTHROPIC_API_KEY = 'k';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      body: sseStream([
        'data: {"type":"message_start"}\n\n',
        'data: {"type":"content_block_stop"}\n\n',
      ]),
    } as unknown as Response);

    const res = await POST(makeRequest({ message: 'hi' }));
    const out = await readAll(res);
    expect(out).toBe('');
  });

  // ── auth gate ──────────────────────────────────────────
  it('401s an unauthenticated request (no token) before calling any provider', async () => {
    process.env.ANTHROPIC_API_KEY = 'k';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await POST(makeRequest({ message: 'hi' }, { auth: false }));
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();   // paid provider never hit
  });
});
