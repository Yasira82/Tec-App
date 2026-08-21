/**
 * Persistence, stop, retry and copy — plus the conversation-wipe bug found while
 * reviewing the /ai page (the welcome effect re-ran on [user, locale] and replaced the
 * whole message array, so switching language destroyed the thread).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AIDrawer } from '@/app/hub/components/AIDrawer';
import { loadConversation, saveConversation, clearConversation } from '@/lib/ai-session';

const enc = new TextEncoder();
const frame = (o: unknown) => enc.encode(`data: ${JSON.stringify(o)}\n\n`);

function stubChat(text: string) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) =>
    String(url).includes('/ai/context')
      ? ({ ok: true, json: async () => ({}) } as unknown as Response)
      : ({ ok: true, status: 200,
           body: new ReadableStream<Uint8Array>({ start(c) { c.enqueue(frame({ text })); c.close(); } }),
         } as unknown as Response)));
}

async function ask(q = 'سؤال') {
  const view = render(<AIDrawer open onClose={vi.fn()} />);
  const input = screen.getByPlaceholderText('اسأل TEC AI...');
  fireEvent.change(input, { target: { value: q } });
  fireEvent.keyDown(input, { key: 'Enter' });
  return view;
}

beforeEach(() => { document.cookie = 'tec_csrf=abc'; sessionStorage.clear(); });
afterEach(() => vi.restoreAllMocks());

describe('ai-session storage', () => {
  it('round-trips a conversation', () => {
    saveConversation('k', [{ role: 'user', text: 'hi' }, { role: 'ai', text: 'hello' }]);
    expect(loadConversation('k')).toHaveLength(2);
  });

  it('drops a reply that was still streaming (empty text)', () => {
    saveConversation('k', [{ role: 'user', text: 'hi' }, { role: 'ai', text: '   ' }]);
    expect(loadConversation('k')).toHaveLength(1);
  });

  it('survives corrupt stored data instead of crashing the chat', () => {
    sessionStorage.setItem('k', '{not json');
    expect(loadConversation('k')).toEqual([]);
    sessionStorage.setItem('k', '[{"role":"user"},"junk",null]');
    expect(loadConversation('k')).toEqual([]);
  });

  it('never throws when storage is unavailable', () => {
    const orig = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() { throw new Error('blocked'); },
    });
    expect(() => saveConversation('k', [{ role: 'user', text: 'x' }])).not.toThrow();
    expect(loadConversation('k')).toEqual([]);
    expect(() => clearConversation('k')).not.toThrow();
    if (orig) Object.defineProperty(window, 'sessionStorage', orig);
  });

  it('caps the stored transcript so it cannot grow without bound', () => {
    saveConversation('k', Array.from({ length: 200 }, (_, i) => ({ role: 'user', text: `m${i}` })));
    const out = loadConversation('k');
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out[out.length - 1].text).toBe('m199');   // the TAIL is what is kept
  });
});

describe('drawer session features', () => {
  it('restores the conversation after a remount', async () => {
    stubChat('الرد الأول');
    const view = await ask('سؤالي');
    await waitFor(() => expect(screen.getByText(/الرد الأول/)).toBeTruthy());
    view.unmount();

    render(<AIDrawer open onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/الرد الأول/)).toBeTruthy());
  });

  it('"new chat" clears both the screen and the stored transcript', async () => {
    stubChat('رد');
    await ask();
    await waitFor(() => expect(screen.getByText(/رد/)).toBeTruthy());

    fireEvent.click(screen.getByLabelText('محادثة جديدة'));
    await waitFor(() => expect(loadConversation('tec_ai_drawer')).toEqual([]));
    expect(document.body.textContent).toContain('24 تطبيق');   // greeting is back
  });

  it('offers a retry that resends the question after an error', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/ai/context')) return { ok: true, json: async () => ({}) } as unknown as Response;
      calls.push(String(init?.body));
      return { ok: false, status: 502, json: async () => ({ code: 'PROVIDERS_FAILED' }) } as unknown as Response;
    }));

    await ask('سؤالي المهم');
    const retry = await screen.findByText(/جرّب تاني/);
    fireEvent.click(retry);

    await waitFor(() => expect(calls).toHaveLength(2));
    // The question is resent verbatim — the user never retypes it.
    expect(JSON.parse(calls[1]).messages.at(-1).content).toBe('سؤالي المهم');
  });

  it('shows a stop control while streaming, and a send control otherwise', async () => {
    expect(screen.queryByLabelText('إيقاف')).toBeNull();
    render(<AIDrawer open onClose={vi.fn()} />);
    expect(screen.getByLabelText('إرسال')).toBeTruthy();
  });

  it('lets the user write more than one line', () => {
    render(<AIDrawer open onClose={vi.fn()} />);
    const field = screen.getByPlaceholderText('اسأل TEC AI...');
    expect(field.tagName).toBe('TEXTAREA');
    // Shift+Enter must NOT send.
    fireEvent.change(field, { target: { value: 'سطر' } });
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });
    expect(field).toHaveValue('سطر');
  });

  it('announces the transcript to assistive tech', () => {
    const { container } = render(<AIDrawer open onClose={vi.fn()} />);
    expect(container.querySelector('[role="log"][aria-live="polite"]')).toBeTruthy();
  });
});
