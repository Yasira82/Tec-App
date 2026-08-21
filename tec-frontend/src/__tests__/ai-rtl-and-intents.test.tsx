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
  const input = screen.getByPlaceholderText('Ask TEC AI...');
  fireEvent.change(input, { target: { value: q } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

beforeEach(() => { document.cookie = 'tec_csrf=abc';
  // The drawer restores its transcript from sessionStorage; without this a test
  // inherits the previous test's conversation instead of a fresh drawer.
  sessionStorage.clear(); });
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
    await waitFor(() => expect(document.body.textContent).toContain('busy'));
  });
});

describe('bidirectional text', () => {
  it('marks the input dir="auto" so mixed Arabic/Latin types in order', () => {
    render(<AIDrawer open onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText('Ask TEC AI...').getAttribute('dir')).toBe('auto');
  });

  it('marks every rendered line dir="auto"', () => {
    const { container } = render(<RichText text={'NX هو تطبيق.\nSecond line.'} />);
    const lines = container.querySelectorAll('div[dir="auto"]');
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it('greets the user instead of showing a bare empty panel', () => {
    render(<AIDrawer open onClose={vi.fn()} />);
    expect(document.body.textContent).toContain('24 apps');
  });

  it('offers starter questions that prefill the input', () => {
    render(<AIDrawer open onClose={vi.fn()} />);
    const chip = screen.getByText('Show my balance');
    fireEvent.click(chip);
    expect(screen.getByPlaceholderText('Ask TEC AI...')).toHaveValue('Show my balance');
  });
});

describe('reply formatting polish', () => {
  it('renders a markdown rule as a divider, not three dashes', () => {
    const { container } = render(<RichText text={'قبل\n---\nبعد'} />);
    expect(container.querySelector('hr')).toBeTruthy();
    expect(container.textContent).not.toContain('---');
  });

  it('links a bare TEC domain the model wrote in prose', () => {
    const { container } = render(<RichText text={'افتح epic.tecosystem.app دلوقتي'} />);
    const a = container.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://epic.tecosystem.app');
    expect(a?.textContent).toBe('epic.tecosystem.app');
  });

  it('keeps sentence punctuation out of the link', () => {
    const { container } = render(<RichText text={'زور nx.tecosystem.app.'} />);
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://nx.tecosystem.app');
    expect(container.textContent).toContain('.');
  });

  it('does not linkify ordinary prose', () => {
    const { container } = render(<RichText text={'ده نص عادي. مفيش روابط هنا'} />);
    expect(container.querySelector('a')).toBeNull();
  });

  it('shows the app emoji on a nav chip so it is not a bare word', async () => {
    stubChat('روح للـ Hub.\n\n[[go:tec]]');
    await ask();
    await waitFor(() => expect(document.querySelector('a[href="/hub"]')).toBeTruthy());
    expect(document.querySelector('a[href="/hub"]')?.textContent).toContain('🔷');
  });
});

describe('markdown tables', () => {
  const TABLE = [
    '| # | التطبيق | النطاق |',
    '|---|---------|--------|',
    '| 1 | Hub | hub.tecosystem.app |',
    '| 2 | Commerce | commerce.tecosystem.app |',
  ].join('\n');

  it('renders a real table instead of raw pipes', () => {
    const { container } = render(<RichText text={TABLE} />);
    expect(container.querySelector('table')).toBeTruthy();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    // The separator row is structure, not content — it must never reach the screen.
    expect(container.textContent).not.toContain('|');
    expect(container.textContent).not.toContain('---');
  });

  it('keeps the header row out of the body', () => {
    const { container } = render(<RichText text={TABLE} />);
    expect(container.querySelectorAll('thead th')).toHaveLength(3);
    expect(container.querySelector('thead')?.textContent).toContain('التطبيق');
  });

  it('still autolinks inside a table cell', () => {
    const { container } = render(<RichText text={TABLE} />);
    const link = container.querySelector('tbody a');
    expect(link?.getAttribute('href')).toBe('https://hub.tecosystem.app');
  });

  it('lets a wide table scroll instead of stretching the bubble', () => {
    const { container } = render(<RichText text={TABLE} />);
    const wrap = container.querySelector('table')?.parentElement;
    expect(wrap?.style.overflowX).toBe('auto');
    expect(wrap?.style.maxWidth).toBe('100%');
  });

  it('does not mistake a lone pipe in prose for a table', () => {
    const { container } = render(<RichText text={'اكتب a | b عشان تفصل'} />);
    expect(container.querySelector('table')).toBeNull();
  });

  it('resumes normal rendering after the table ends', () => {
    const { container } = render(<RichText text={`${TABLE}\n\nكل تطبيق له مجال.`} />);
    expect(container.querySelector('table')).toBeTruthy();
    expect(container.textContent).toContain('كل تطبيق له مجال.');
  });
});

describe('table column readability', () => {
  const TABLE = [
    '| التطبيق | رابط |',
    '|---------|------|',
    '| Commerce | commerce.tecosystem.app |',
  ].join('\n');

  it('does not wrap cells — a domain must not shred into hub.tec / osyste / m.app', () => {
    const { container } = render(<RichText text={TABLE} />);
    const td = container.querySelector('tbody td');
    expect(td?.getAttribute('style')).toContain('white-space: nowrap');
  });

  it('lets the table size to its content instead of being squeezed to the container', () => {
    const { container } = render(<RichText text={TABLE} />);
    // No min-width forcing the columns into slivers; the wrapper scrolls instead.
    expect(container.querySelector('table')?.style.minWidth).toBe('');
    expect(container.querySelector('table')?.parentElement?.style.overflowX).toBe('auto');
  });
});
