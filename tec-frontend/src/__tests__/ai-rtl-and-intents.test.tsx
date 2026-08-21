/**
 * Rendering defects reported from a real session in the Pi Browser.
 *
 * 1. The drawer printed the model's machine marker `[[go:nx]]` to the user as text. The
 *    /ai page has always stripped it via parseNavIntents; the drawer never called it.
 * 2. Mixed Arabic + Latin ("ايه dx") rendered in the wrong order — no `dir` anywhere, so
 *    the browser laid Arabic out inside an LTR box and punctuation landed at the wrong end.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AIDrawer } from '@/app/hub/components/AIDrawer';
import { RichText } from '@/components/ai/RichText';

const enc = new TextEncoder();
const frame = (o: unknown) => enc.encode(`data: ${JSON.stringify(o)}\n\n`);

function stubChat(text: string) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).includes('/ai/context')) {
      return { ok: true, json: async () => ({}) } as unknown as Response;
    }
    return {
      ok: true, status: 200,
      body: new ReadableStream<Uint8Array>({ start(c) { c.enqueue(frame({ text })); c.close(); } }),
    } as unknown as Response;
  }));
}

async function ask(q = 'nx ايه') {
  render(<AIDrawer open onClose={vi.fn()} />);
  const input = screen.getByPlaceholderText('اسأل TEC AI...');
  fireEvent.change(input, { target: { value: q } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

beforeEach(() => { document.cookie = 'tec_csrf=abc'; });
afterEach(() => vi.restoreAllMocks());

describe('nav intents in the Hub drawer', () => {
  it('never prints the [[go:...]] marker to the user', async () => {
    stubChat('NX هو تطبيق الفرص.\n\n[[go:nx]]');
    await ask();
    await waitFor(() => expect(screen.getByText(/تطبيق الفرص/)).toBeTruthy());
    expect(document.body.textContent).not.toContain('[[go:');
  });

  it('turns the marker into a link the user can follow', async () => {
    stubChat('جرّب NX.\n\n[[go:nx]]');
    await ask();
    await waitFor(() => {
      const links = Array.from(document.querySelectorAll('a,[href]'));
      expect(links.length).toBeGreaterThan(0);
    });
  });

  it('leaves an error message alone — no marker parsing on failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      String(url).includes('/ai/context')
        ? ({ ok: true, json: async () => ({}) } as unknown as Response)
        : ({ ok: false, status: 503, json: async () => ({ code: 'BUSY' }) } as unknown as Response)));
    await ask();
    await waitFor(() => expect(document.body.textContent).toContain('مشغول'));
  });
});

describe('bidirectional text', () => {
  it('marks the input dir="auto" so mixed Arabic/Latin types in order', () => {
    render(<AIDrawer open onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText('اسأل TEC AI...').getAttribute('dir')).toBe('auto');
  });

  it('marks every rendered line dir="auto"', () => {
    const { container } = render(<RichText text={'NX هو تطبيق.\nSecond line.'} />);
    const lines = container.querySelectorAll('div[dir="auto"]');
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it('greets the user instead of showing a bare empty panel', () => {
    render(<AIDrawer open onClose={vi.fn()} />);
    expect(document.body.textContent).toContain('24 تطبيق');
  });

  it('offers starter questions that prefill the input', () => {
    render(<AIDrawer open onClose={vi.fn()} />);
    const chip = screen.getByText('وريني رصيدي');
    fireEvent.click(chip);
    expect(screen.getByPlaceholderText('اسأل TEC AI...')).toHaveValue('وريني رصيدي');
  });
});
