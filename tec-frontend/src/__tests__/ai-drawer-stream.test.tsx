/**
 * AIDrawer streaming behaviour — the three things the user reported.
 *
 * The pre-existing AIDrawer tests only rendered the closed/open shell, which is why a
 * drawer that buffered the ENTIRE answer and printed raw `**` passed them for months.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AIDrawer } from '@/app/hub/components/AIDrawer';

const enc = new TextEncoder();
const frame = (o: unknown) => enc.encode(`data: ${JSON.stringify(o)}\n\n`);

/** A stream that hands out chunks only when `release()` is called — lets the test
 *  observe the DOM BETWEEN deltas, which is the whole point of streaming. */
function pacedStream(chunks: Uint8Array[]) {
  let push: (() => void) | null = null;
  const gate = () => new Promise<void>(res => { push = res; });
  let waiter = gate();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const c of chunks) {
        await waiter;
        waiter = gate();
        controller.enqueue(c);
      }
      controller.close();
    },
  });
  return {
    stream,
    release: async () => { push?.(); await new Promise(r => setTimeout(r, 0)); },
  };
}

const okStream = (body: ReadableStream<Uint8Array>) =>
  ({ ok: true, status: 200, body }) as unknown as Response;

/**
 * The drawer also fetches /api/bff/ai/context on open (personalization). Route by URL so
 * a test's chat mocks are not consumed by that call — and so a test can assert on the
 * chat request specifically.
 */
function stubFetch(chat: (n: number) => Response | Promise<Response>) {
  let n = 0;
  const chatCalls: RequestInit[] = [];
  const mock = vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes('/ai/context')) {
      return { ok: true, json: async () => ({ username: 'yas55eR82' }) } as unknown as Response;
    }
    chatCalls.push(init ?? {});
    return chat(n++);
  });
  vi.stubGlobal('fetch', mock);
  return { chatCalls };
}

beforeEach(() => {
  document.cookie = 'tec_csrf=abc';
});
afterEach(() => vi.restoreAllMocks());

async function ask(question = 'ما هو TEC؟') {
  render(<AIDrawer open onClose={vi.fn()} />);
  const input = screen.getByPlaceholderText('اسأل TEC AI...');
  fireEvent.change(input, { target: { value: question } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

describe('AIDrawer streaming', () => {
  it('renders the reply progressively instead of all at once', async () => {
    const paced = pacedStream([frame({ text: 'أهلاً ' }), frame({ text: 'بيك' })]);
    stubFetch(() => okStream(paced.stream));

    await ask();
    await paced.release();
    // First half is on screen while the stream is still open — this is the bug fix:
    // previously nothing rendered until the very last chunk.
    await waitFor(() => expect(screen.getByText(/أهلاً/)).toBeTruthy());
    expect(screen.queryByText(/بيك/)).toBeNull();

    await paced.release();
    await waitFor(() => expect(screen.getByText(/بيك/)).toBeTruthy());
  });

  it('renders **bold** as bold text, never as asterisks', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(frame({ text: '**Shop & Sell:** buy things' })); c.close(); },
    });
    stubFetch(() => okStream(stream));

    await ask();
    await waitFor(() => expect(screen.getByText('Shop & Sell:').tagName).toBe('STRONG'));
    expect(document.body.textContent).not.toContain('**');
  });

  it('marks a capped answer as incomplete rather than ending mid-sentence', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(frame({ text: 'Manage Assets: Hold and' }));
        c.enqueue(frame({ truncated: true }));
        c.close();
      },
    });
    stubFetch(() => okStream(stream));

    await ask();
    await waitFor(() => expect(document.body.textContent).toContain('اتقطعت'));
  });

  it('sends the earlier turns so a follow-up keeps context', async () => {
    const reply = (text: string) => okStream(new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(frame({ text })); c.close(); },
    }));
    const { chatCalls } = stubFetch(n => (n === 0 ? reply('TEC هي منصة') : reply('نعم')));

    await ask('ما هو TEC؟');
    await waitFor(() => expect(screen.getByText(/TEC هي منصة/)).toBeTruthy());

    const input = screen.getByPlaceholderText('اسأل TEC AI...');
    fireEvent.change(input, { target: { value: 'وبعدين؟' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(chatCalls).toHaveLength(2));
    const sent = JSON.parse(chatCalls[1].body as string);
    expect(sent.messages).toEqual([
      { role: 'user',      content: 'ما هو TEC؟' },
      { role: 'assistant', content: 'TEC هي منصة' },
      { role: 'user',      content: 'وبعدين؟' },
    ]);
  });

  // The /ai page always sent the user's own context; this drawer sent none, so the SAME
  // assistant answered generically in the Hub and personally on /ai.
  it('sends the user context so the Hub answer is personalized too', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(frame({ text: 'hi' })); c.close(); },
    });
    const { chatCalls } = stubFetch(() => okStream(stream));

    await ask();
    await waitFor(() => expect(chatCalls).toHaveLength(1));
    const sent = JSON.parse(chatCalls[0].body as string);
    expect(sent.userContext.username).toBe('yas55eR82');
    expect(sent.userContext.locale).toBeTruthy();
  });

  it('still answers when the context fetch fails (fail-soft)', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(frame({ text: 'يعمل بدون سياق' })); c.close(); },
    });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/ai/context')) throw new Error('offline');
      return okStream(stream);
    }));

    await ask();
    await waitFor(() => expect(screen.getByText(/يعمل بدون سياق/)).toBeTruthy());
  });

  it('surfaces the real reason from the route\'s error code', async () => {
    // The route sends an explicit `code`; the drawer must key off THAT, not the status.
    stubFetch(() => ({ ok: false, status: 429, json: async () => ({ code: 'RATE_LIMIT' }) }) as unknown as Response);
    await ask();
    await waitFor(() => expect(document.body.textContent).toContain('وصلت للحد الأقصى'));
  });

  // Both of these are HTTP 503. Before the route sent a code, the drawer mapped 503 to a
  // single message — so a BUSY assistant told the user it was switched off.
  it('tells BUSY apart from NOT_CONFIGURED, though both are 503', async () => {
    stubFetch(() => ({ ok: false, status: 503, json: async () => ({ code: 'BUSY' }) }) as unknown as Response);
    await ask();
    await waitFor(() => expect(document.body.textContent).toContain('مشغول'));
    expect(document.body.textContent).not.toContain('مش مفعّل');
  });

  it('never leaves an empty bubble when the stream yields no text', async () => {
    const stream = new ReadableStream<Uint8Array>({ start(c) { c.close(); } });
    stubFetch(() => okStream(stream));
    await ask();
    await waitFor(() => expect(document.body.textContent).toContain('لم أتمكّن من الرد'));
  });
});
