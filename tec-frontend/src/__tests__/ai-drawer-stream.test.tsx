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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okStream(paced.stream)));

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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okStream(stream)));

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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okStream(stream)));

    await ask();
    await waitFor(() => expect(document.body.textContent).toContain('اتقطعت'));
  });

  it('sends the earlier turns so a follow-up keeps context', async () => {
    const reply = (text: string) => okStream(new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(frame({ text })); c.close(); },
    }));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(reply('TEC هي منصة'))
      .mockResolvedValueOnce(reply('نعم'));
    vi.stubGlobal('fetch', fetchMock);

    await ask('ما هو TEC؟');
    await waitFor(() => expect(screen.getByText(/TEC هي منصة/)).toBeTruthy());

    const input = screen.getByPlaceholderText('اسأل TEC AI...');
    fireEvent.change(input, { target: { value: 'وبعدين؟' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const sent = JSON.parse((fetchMock.mock.calls[1][1] as { body: string }).body);
    expect(sent.messages).toEqual([
      { role: 'user',      content: 'ما هو TEC؟' },
      { role: 'assistant', content: 'TEC هي منصة' },
      { role: 'user',      content: 'وبعدين؟' },
    ]);
  });

  it('surfaces the real reason on an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 } as Response));
    await ask();
    await waitFor(() => expect(document.body.textContent).toContain('وصلت للحد الأقصى'));
  });

  it('never leaves an empty bubble when the stream yields no text', async () => {
    const stream = new ReadableStream<Uint8Array>({ start(c) { c.close(); } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okStream(stream)));
    await ask();
    await waitFor(() => expect(document.body.textContent).toContain('لم أتمكّن من الرد'));
  });
});
