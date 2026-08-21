/**
 * The AI chat stream's two production failures, pinned.
 *
 * Both bugs were invisible to the old smoke tests because those only asserted "the
 * drawer renders". These assert the two behaviours the user actually saw break:
 * an answer that stopped mid-sentence, and `**bold**` printed as asterisks.
 */
import { describe, it, expect } from 'vitest';
import { createSseReader, parseInline, parseRich } from '@/lib/ai-stream';

const frame = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;

describe('createSseReader', () => {
  it('decodes whole frames', () => {
    const r = createSseReader();
    expect(r.push(frame({ text: 'Hello ' }) + frame({ text: 'world' })).text)
      .toBe('Hello world');
  });

  // THE truncation bug: the old parser split each network chunk on its own, so a frame
  // arriving in two pieces failed JSON.parse and was silently dropped.
  it('does not lose a frame split across chunk boundaries', () => {
    const r = createSseReader();
    const whole = frame({ text: 'complete sentence' });
    const cut   = Math.floor(whole.length / 2);

    const first  = r.push(whole.slice(0, cut));
    const second = r.push(whole.slice(cut));

    expect(first.text + second.text).toBe('complete sentence');
  });

  it('reassembles a frame split into many tiny pieces', () => {
    const r = createSseReader();
    const stream = frame({ text: 'a' }) + frame({ text: 'b' }) + frame({ text: 'c' });
    let out = '';
    for (const ch of stream) out += r.push(ch).text;
    out += r.flush().text;
    expect(out).toBe('abc');
  });

  it('ignores [DONE] and keepalive lines', () => {
    const r = createSseReader();
    expect(r.push(': keepalive\ndata: [DONE]\n\n').text).toBe('');
  });

  it('skips an unparseable frame without dropping the rest', () => {
    const r = createSseReader();
    expect(r.push('data: {not json}\n' + frame({ text: 'kept' })).text).toBe('kept');
  });

  it('reports the provider truncation flag', () => {
    const r = createSseReader();
    const d = r.push(frame({ text: 'cut off here' }) + frame({ truncated: true }));
    expect(d.text).toBe('cut off here');
    expect(d.truncated).toBe(true);
  });

  it('flush drains a final line that arrived without a trailing newline', () => {
    const r = createSseReader();
    expect(r.push('data: {"text":"tail"}').text).toBe('');   // held back, incomplete
    expect(r.flush().text).toBe('tail');
  });

  it('flush is empty when nothing is pending', () => {
    const r = createSseReader();
    r.push(frame({ text: 'x' }));
    expect(r.flush()).toEqual({ text: '', truncated: false });
  });
});

describe('parseInline', () => {
  it('extracts bold runs instead of printing asterisks', () => {
    expect(parseInline('Use **TEC** now')).toEqual([
      { kind: 'text', value: 'Use ' },
      { kind: 'bold', value: 'TEC' },
      { kind: 'text', value: ' now' },
    ]);
  });

  it('extracts inline code', () => {
    expect(parseInline('run `npm test`')).toEqual([
      { kind: 'text', value: 'run ' },
      { kind: 'code', value: 'npm test' },
    ]);
  });

  it('leaves plain text untouched', () => {
    expect(parseInline('just text')).toEqual([{ kind: 'text', value: 'just text' }]);
  });

  it('handles a bold run at the start of the line', () => {
    expect(parseInline('**Shop & Sell:** buy things')).toEqual([
      { kind: 'bold', value: 'Shop & Sell:' },
      { kind: 'text', value: ' buy things' },
    ]);
  });

  it('never emits a token containing raw markers', () => {
    for (const tok of parseInline('**a** and **b**')) {
      expect(tok.value).not.toContain('**');
    }
  });
});

describe('parseRich', () => {
  it('classifies bullets, headings and text', () => {
    const lines = parseRich('# Title\n- one\n* two\nplain');
    expect(lines.map(l => l.kind)).toEqual(['heading', 'bullet', 'bullet', 'text']);
    expect(lines[1].tokens[0]).toEqual({ kind: 'text', value: 'one' });
  });

  it('keeps blank lines as empty rows so paragraphs stay apart', () => {
    const lines = parseRich('a\n\nb');
    expect(lines).toHaveLength(3);
    expect(lines[1].tokens).toEqual([]);
  });

  it('parses bold inside a bullet', () => {
    const [line] = parseRich('- **Manage Assets:** hold and trade');
    expect(line.kind).toBe('bullet');
    expect(line.tokens[0]).toEqual({ kind: 'bold', value: 'Manage Assets:' });
  });
});
